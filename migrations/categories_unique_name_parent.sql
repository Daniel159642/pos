-- Migration: Categories UNIQUE(category_name, parent_category_id)
-- Allows same category name under different parents (e.g. "Phones" under Electronics vs Audio).
-- Run after schema_postgres.sql or on existing DBs.

-- 1. Drop old UNIQUE on category_name
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_category_name_key;

-- 2. Roots: unique on category_name where parent_category_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_root_name
    ON categories (category_name) WHERE parent_category_id IS NULL;

-- 3. Non-roots: unique on (category_name, parent_category_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent
    ON categories (category_name, parent_category_id) WHERE parent_category_id IS NOT NULL;

-- 4. Keep non-unique indexes for lookups
DROP INDEX IF EXISTS idx_categories_name;
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (category_name);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_category_id);
