-- DoorDash Recipes: operation_context (RECIPE) and quantity_info for items and options.

-- Item level: mark menu item as recipe-based
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS doordash_operation_context JSONB;

COMMENT ON COLUMN inventory.doordash_operation_context IS 'DoorDash menu: operation_context array e.g. ["RECIPE"] for recipe-based items.';

-- Option (variant) level: default quantity and charge-above for recipe options
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS doordash_default_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_charge_above INTEGER,
  ADD COLUMN IF NOT EXISTS doordash_recipe_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN product_variants.doordash_default_quantity IS 'Recipe default quantity for this option (included in item price).';
COMMENT ON COLUMN product_variants.doordash_charge_above IS 'Charge above this quantity (each extra charged at option price).';
COMMENT ON COLUMN product_variants.doordash_recipe_default IS 'True if this option is the default recipe option for the modifier group.';
