-- StuffFinder schema v3: multi-photo per item
-- Run this in the Supabase SQL Editor (without RLS, same as v2).
--
-- Non-destructive: existing photo_path values are migrated into the new
-- item_photos table before the column is dropped.

-- ==============
-- Dependencies that reference items.photo_path — drop in the right order
-- ==============
DROP FUNCTION IF EXISTS search_items(TEXT);
DROP VIEW     IF EXISTS items_with_details CASCADE;

-- ==============
-- New table: one row per photo, ordered per item
-- ==============
CREATE TABLE IF NOT EXISTS item_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS item_photos_item_idx      ON item_photos(item_id, sort_order);
CREATE INDEX IF NOT EXISTS item_photos_household_idx ON item_photos(household_id);

ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_photos_all ON item_photos;
CREATE POLICY item_photos_all ON item_photos FOR ALL TO authenticated
    USING (is_household_member(household_id))
    WITH CHECK (is_household_member(household_id));

-- ==============
-- Backfill: copy existing items.photo_path → item_photos, sort_order = 0
-- ==============
-- Safe to re-run: only inserts rows that don't already exist for that item.
INSERT INTO item_photos (item_id, household_id, path, sort_order)
SELECT i.id, i.household_id, i.photo_path, 0
FROM items i
WHERE i.photo_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM item_photos p WHERE p.item_id = i.id);

-- ==============
-- Recreate the view so photo_path is derived (first photo by sort_order)
-- ==============
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
    lp.full_path AS location_full_path
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN locations  l ON i.location_id = l.id
LEFT JOIN location_path lp ON l.id = lp.id;

GRANT SELECT ON items_with_details TO authenticated;

-- ==============
-- Recreate search_items (now relies on the new view definition)
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
-- Drop the old items.photo_path column (data already migrated above)
-- ==============
ALTER TABLE items DROP COLUMN IF EXISTS photo_path;
