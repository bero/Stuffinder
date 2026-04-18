-- StuffFinder Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories table
-- Examples: Tools, Electronics, Documents, Clothes, Kitchen, etc.
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) DEFAULT '📦',  -- Emoji icon
    color VARCHAR(7) DEFAULT '#6B7280',  -- Hex color for UI
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT categories_name_unique UNIQUE (name)
);

-- Locations table (hierarchical)
-- Examples: Garage, Garage > Shelf 1, Bedroom > Closet, etc.
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    icon VARCHAR(10) DEFAULT '📍',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate names under same parent
    CONSTRAINT locations_name_parent_unique UNIQUE (name, parent_id)
);

-- Items table - the main content
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    photo_path VARCHAR(500),  -- Path in Supabase Storage
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast text search on items
CREATE INDEX items_name_idx ON items USING gin(to_tsvector('english', name));
CREATE INDEX items_description_idx ON items USING gin(to_tsvector('english', COALESCE(description, '')));

-- Index for filtering
CREATE INDEX items_category_idx ON items(category_id);
CREATE INDEX items_location_idx ON items(location_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- View for items with full location path (e.g., "Garage > Shelf 1")
CREATE OR REPLACE VIEW items_with_details AS
WITH RECURSIVE location_path AS (
    -- Base case: locations without parent
    SELECT 
        id,
        name,
        parent_id,
        name::TEXT AS full_path
    FROM locations
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: locations with parent
    SELECT 
        l.id,
        l.name,
        l.parent_id,
        (lp.full_path || ' > ' || l.name)::TEXT AS full_path
    FROM locations l
    INNER JOIN location_path lp ON l.parent_id = lp.id
)
SELECT 
    i.id,
    i.name,
    i.description,
    i.photo_path,
    i.created_at,
    i.updated_at,
    c.id AS category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    l.id AS location_id,
    l.name AS location_name,
    lp.full_path AS location_full_path
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN locations l ON i.location_id = l.id
LEFT JOIN location_path lp ON l.id = lp.id;

-- Insert some default categories
INSERT INTO categories (name, icon, color, sort_order) VALUES
    ('Tools', '🔧', '#EF4444', 1),
    ('Electronics', '💻', '#3B82F6', 2),
    ('Documents', '📄', '#10B981', 3),
    ('Clothes', '👕', '#8B5CF6', 4),
    ('Kitchen', '🍳', '#F59E0B', 5),
    ('Sports', '⚽', '#06B6D4', 6),
    ('Books', '📚', '#EC4899', 7),
    ('Other', '📦', '#6B7280', 99);

-- Insert some default locations
INSERT INTO locations (name, icon, sort_order) VALUES
    ('Garage', '🏠', 1),
    ('Bedroom', '🛏️', 2),
    ('Living Room', '🛋️', 3),
    ('Kitchen', '🍽️', 4),
    ('Bathroom', '🚿', 5),
    ('Attic', '🏚️', 6),
    ('Basement', '🪜', 7),
    ('Storage Unit', '📦', 8);

-- Row Level Security (RLS) - for single user, keep it simple
-- If you want multi-user later, you'd add user_id columns and proper policies

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (single user scenario)
-- Using anon key means anyone with the key can access
-- This is acceptable for a personal app

CREATE POLICY "Allow all for categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for items" ON items FOR ALL USING (true) WITH CHECK (true);

-- Grant access to the view
GRANT SELECT ON items_with_details TO anon, authenticated;

-- Function for full-text search
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
$$ LANGUAGE plpgsql;
