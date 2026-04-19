-- StuffFinder schema v4: tags
-- Run in the Supabase SQL Editor (without RLS).
--
-- Non-destructive. Adds two tables (tags, item_tags) and extends the
-- items_with_details view with a tags json array. search_items also gets a
-- pass through tag names.

-- ==============
-- Tags (flat per-household list)
-- ==============
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (household_id, name)
);
CREATE INDEX IF NOT EXISTS tags_household_idx ON tags(household_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tags_all ON tags;
CREATE POLICY tags_all ON tags FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

-- ==============
-- item_tags junction table
-- ==============
CREATE TABLE IF NOT EXISTS item_tags (
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (item_id, tag_id)
);
CREATE INDEX IF NOT EXISTS item_tags_tag_idx ON item_tags(tag_id);

ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS item_tags_all ON item_tags;
CREATE POLICY item_tags_all ON item_tags FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM items i
         WHERE i.id = item_tags.item_id
           AND is_household_member(i.household_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM items i
         WHERE i.id = item_tags.item_id
           AND is_household_member(i.household_id)
    ));

-- ==============
-- Update items_with_details view: add tags array
-- ==============
DROP FUNCTION IF EXISTS search_items(TEXT);
DROP VIEW IF EXISTS items_with_details CASCADE;

CREATE VIEW items_with_details
WITH (security_invoker = on)
AS
WITH RECURSIVE location_path AS (
    SELECT id, name, parent_id, household_id, name::TEXT AS full_path
    FROM locations WHERE parent_id IS NULL

    UNION ALL

    SELECT l.id, l.name, l.parent_id, l.household_id,
           (lp.full_path || ' > ' || l.name)::TEXT
    FROM locations l
    INNER JOIN location_path lp ON l.parent_id = lp.id
)
SELECT
    i.id,
    i.household_id,
    i.name,
    i.description,
    (SELECT p.path FROM item_photos p
       WHERE p.item_id = i.id
       ORDER BY p.sort_order, p.created_at
       LIMIT 1) AS photo_path,
    i.created_at,
    i.updated_at,
    c.id    AS category_id,
    c.name  AS category_name,
    c.icon  AS category_icon,
    c.color AS category_color,
    l.id    AS location_id,
    l.name  AS location_name,
    lp.full_path AS location_full_path,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
         FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id = i.id),
        '[]'::jsonb
    ) AS tags
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN locations  l ON i.location_id = l.id
LEFT JOIN location_path lp ON l.id = lp.id;

GRANT SELECT ON items_with_details TO authenticated;

-- ==============
-- Recreate search_items, now also searching tag names
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
            OR EXISTS (
                SELECT 1 FROM item_tags it
                  JOIN tags t ON t.id = it.tag_id
                 WHERE it.item_id = iwd.id
                   AND t.name ILIKE '%' || search_query || '%'
            )
        ORDER BY
            CASE WHEN iwd.name ILIKE search_query || '%' THEN 0 ELSE 1 END,
            iwd.updated_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
