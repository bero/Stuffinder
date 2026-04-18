-- StuffFinder v2: Multi-household schema
-- Run this in the Supabase SQL Editor.
--
-- WARNING: destructive — drops existing items/locations/categories tables.
-- Only safe because current data is test-only.
--
-- AFTER running: in Storage → photos bucket → turn OFF "Public bucket".
-- The storage policies at the bottom of this file replace the public access.

-- ==============
-- Clean slate
-- ==============
DROP FUNCTION IF EXISTS search_items(TEXT);
DROP VIEW     IF EXISTS items_with_details CASCADE;
DROP FUNCTION IF EXISTS accept_invite(TEXT);
DROP FUNCTION IF EXISTS create_invite(UUID);
DROP FUNCTION IF EXISTS generate_invite_code();
DROP FUNCTION IF EXISTS create_household(TEXT);
DROP FUNCTION IF EXISTS is_household_member(UUID);
DROP TABLE    IF EXISTS items;
DROP TABLE    IF EXISTS locations;
DROP TABLE    IF EXISTS categories;
DROP TABLE    IF EXISTS household_invites;
DROP TABLE    IF EXISTS household_members;
DROP TABLE    IF EXISTS households;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============
-- Households
-- ==============
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE household_members (
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id)
);
CREATE INDEX household_members_user_idx ON household_members(user_id);

CREATE TABLE household_invites (
    code VARCHAR(12) PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX household_invites_household_idx ON household_invites(household_id);

-- Helper used by RLS. SECURITY DEFINER avoids recursion when checking membership.
CREATE OR REPLACE FUNCTION is_household_member(h_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = h_id AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ==============
-- Categories (per-household)
-- ==============
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',
    color VARCHAR(7) DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (household_id, name)
);
CREATE INDEX categories_household_idx ON categories(household_id);

-- ==============
-- Locations (per-household, hierarchical)
-- ==============
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    icon VARCHAR(10) DEFAULT '📍',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (household_id, name, parent_id)
);
CREATE INDEX locations_household_idx ON locations(household_id);

-- ==============
-- Items
-- ==============
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    photo_path VARCHAR(500),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX items_household_idx ON items(household_id);
CREATE INDEX items_name_idx ON items USING gin(to_tsvector('english', name));
CREATE INDEX items_description_idx ON items USING gin(to_tsvector('english', COALESCE(description, '')));
CREATE INDEX items_category_idx ON items(category_id);
CREATE INDEX items_location_idx ON items(location_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============
-- View: items with joined details
-- security_invoker = on so the caller's RLS on items applies to the view too.
-- ==============
CREATE VIEW items_with_details
WITH (security_invoker = on)
AS
WITH RECURSIVE location_path AS (
    SELECT id, name, parent_id, household_id, name::TEXT AS full_path
    FROM locations
    WHERE parent_id IS NULL

    UNION ALL

    SELECT l.id, l.name, l.parent_id, l.household_id,
           (lp.full_path || ' > ' || l.name)::TEXT AS full_path
    FROM locations l
    INNER JOIN location_path lp ON l.parent_id = lp.id
)
SELECT
    i.id,
    i.household_id,
    i.name,
    i.description,
    i.photo_path,
    i.created_at,
    i.updated_at,
    c.id    AS category_id,
    c.name  AS category_name,
    c.icon  AS category_icon,
    c.color AS category_color,
    l.id    AS location_id,
    l.name  AS location_name,
    lp.full_path AS location_full_path
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN locations  l ON i.location_id = l.id
LEFT JOIN location_path lp ON l.id = lp.id;

GRANT SELECT ON items_with_details TO authenticated;

-- ==============
-- Search function (runs with invoker's RLS)
-- ==============
CREATE OR REPLACE FUNCTION search_items(search_query TEXT)
RETURNS SETOF items_with_details AS $$
BEGIN
    IF search_query IS NULL OR search_query = '' THEN
        RETURN QUERY SELECT * FROM items_with_details ORDER BY updated_at DESC;
    ELSE
        RETURN QUERY
        SELECT iwd.*
        FROM items_with_details iwd
        WHERE
            iwd.name ILIKE '%' || search_query || '%'
            OR iwd.description ILIKE '%' || search_query || '%'
            OR iwd.category_name ILIKE '%' || search_query || '%'
            OR iwd.location_full_path ILIKE '%' || search_query || '%'
        ORDER BY
            CASE WHEN iwd.name ILIKE search_query || '%' THEN 0 ELSE 1 END,
            iwd.updated_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ==============
-- RLS
-- ==============
ALTER TABLE households         ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;

-- Households: only members see their households; no direct writes (use RPCs)
CREATE POLICY households_select ON households FOR SELECT TO authenticated
    USING (is_household_member(id));

-- Members: see members of own households; can delete own row (leave)
CREATE POLICY members_select ON household_members FOR SELECT TO authenticated
    USING (is_household_member(household_id));
CREATE POLICY members_leave ON household_members FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Invites: visible to and creatable/deletable by members of the household
CREATE POLICY invites_select ON household_invites FOR SELECT TO authenticated
    USING (is_household_member(household_id));
CREATE POLICY invites_delete ON household_invites FOR DELETE TO authenticated
    USING (is_household_member(household_id));

-- Content tables: full access for members of the household
CREATE POLICY categories_all ON categories FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

CREATE POLICY locations_all ON locations FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

CREATE POLICY items_all ON items FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

-- ==============
-- RPCs
-- ==============

-- Create a household, add caller as owner, seed defaults.
CREATE OR REPLACE FUNCTION create_household(h_name TEXT)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF h_name IS NULL OR length(trim(h_name)) = 0 THEN
        RAISE EXCEPTION 'Household name required';
    END IF;

    INSERT INTO households (name, created_by)
    VALUES (trim(h_name), auth.uid())
    RETURNING id INTO new_id;

    INSERT INTO household_members (household_id, user_id, role)
    VALUES (new_id, auth.uid(), 'owner');

    INSERT INTO categories (household_id, name, icon, color, sort_order) VALUES
        (new_id, 'Tools',       '🔧', '#EF4444', 1),
        (new_id, 'Electronics', '💻', '#3B82F6', 2),
        (new_id, 'Documents',   '📄', '#10B981', 3),
        (new_id, 'Clothes',     '👕', '#8B5CF6', 4),
        (new_id, 'Kitchen',     '🍳', '#F59E0B', 5),
        (new_id, 'Sports',      '⚽', '#06B6D4', 6),
        (new_id, 'Books',       '📚', '#EC4899', 7),
        (new_id, 'Other',       '📦', '#6B7280', 99);

    INSERT INTO locations (household_id, name, icon, sort_order) VALUES
        (new_id, 'Garage',       '🏠', 1),
        (new_id, 'Bedroom',      '🛏️', 2),
        (new_id, 'Living Room',  '🛋️', 3),
        (new_id, 'Kitchen',      '🍽️', 4),
        (new_id, 'Bathroom',     '🚿', 5),
        (new_id, 'Attic',        '🏚️', 6),
        (new_id, 'Basement',     '🪜', 7),
        (new_id, 'Storage Unit', '📦', 8);

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8-char invite code, no confusing chars (0/O, 1/I/L).
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a 7-day invite, return its code.
CREATE OR REPLACE FUNCTION create_invite(h_id UUID)
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    IF NOT is_household_member(h_id) THEN
        RAISE EXCEPTION 'Not a member of this household';
    END IF;

    LOOP
        new_code := generate_invite_code();
        BEGIN
            INSERT INTO household_invites (code, household_id, created_by, expires_at)
            VALUES (new_code, h_id, auth.uid(), NOW() + INTERVAL '7 days');
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            -- regenerate
        END;
    END LOOP;

    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept an invite, joining the household. Returns household_id on success.
CREATE OR REPLACE FUNCTION accept_invite(invite_code TEXT)
RETURNS UUID AS $$
DECLARE
    v_code         TEXT;
    v_household_id UUID;
    v_used_at      TIMESTAMPTZ;
    v_expires_at   TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_code := upper(trim(invite_code));

    SELECT household_id, used_at, expires_at
    INTO v_household_id, v_used_at, v_expires_at
    FROM household_invites
    WHERE code = v_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;
    IF v_used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invite already used';
    END IF;
    IF v_expires_at < NOW() THEN
        RAISE EXCEPTION 'Invite expired';
    END IF;
    IF EXISTS (SELECT 1 FROM household_members
               WHERE household_id = v_household_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Already a member of this household';
    END IF;

    INSERT INTO household_members (household_id, user_id, role)
    VALUES (v_household_id, auth.uid(), 'member');

    UPDATE household_invites
    SET used_at = NOW(), used_by = auth.uid()
    WHERE code = v_code;

    RETURN v_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============
-- Storage RLS (photos bucket, paths formatted as "{household_id}/{filename}")
-- Run AFTER flipping the photos bucket to private.
-- ==============
DROP POLICY IF EXISTS "auth_read_photos"          ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_photos"        ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_photos"        ON storage.objects;
DROP POLICY IF EXISTS "household_read_photos"     ON storage.objects;
DROP POLICY IF EXISTS "household_insert_photos"   ON storage.objects;
DROP POLICY IF EXISTS "household_delete_photos"   ON storage.objects;

CREATE POLICY household_read_photos ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY household_insert_photos ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY household_delete_photos ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1]::uuid IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );
