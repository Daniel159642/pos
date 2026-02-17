-- DoorDash nutritional and dietary information for menu items and modifiers.

-- Item level: calorific range and dietary tags
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS doordash_calorific_display_type TEXT,
  ADD COLUMN IF NOT EXISTS doordash_calorific_lower_range INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_calorific_higher_range INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_classification_tags JSONB;

COMMENT ON COLUMN inventory.doordash_calorific_display_type IS 'DoorDash: display_type for calorific_info (e.g. cal).';
COMMENT ON COLUMN inventory.doordash_calorific_lower_range IS 'DoorDash: lower_range for calorific_info (calories).';
COMMENT ON COLUMN inventory.doordash_calorific_higher_range IS 'DoorDash: higher_range for calorific_info (calories).';
COMMENT ON COLUMN inventory.doordash_classification_tags IS 'DoorDash: classification_tags array e.g. [TAG_KEY_DIETARY_VEGETARIAN, TAG_KEY_DIETARY_VEGAN, TAG_KEY_DIETARY_GLUTEN_FREE].';

-- Modifier (variant) level: same structure
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS doordash_calorific_display_type TEXT,
  ADD COLUMN IF NOT EXISTS doordash_calorific_lower_range INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_calorific_higher_range INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_classification_tags JSONB;

COMMENT ON COLUMN product_variants.doordash_calorific_display_type IS 'DoorDash: display_type for option calorific_info.';
COMMENT ON COLUMN product_variants.doordash_calorific_lower_range IS 'DoorDash: lower_range for option calorific_info.';
COMMENT ON COLUMN product_variants.doordash_calorific_higher_range IS 'DoorDash: higher_range for option calorific_info.';
COMMENT ON COLUMN product_variants.doordash_classification_tags IS 'DoorDash: classification_tags for option (dietary tags).';
