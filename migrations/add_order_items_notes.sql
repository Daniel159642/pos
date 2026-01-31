-- Add notes to order_items for modifier/topping text (e.g. "Pepperoni, ½ Peppers")
-- Run after add_product_variants_and_ingredients.sql if needed

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN order_items.notes IS 'Modifier/topping/customization text for the line item (e.g. "Pepperoni, ½ Peppers" for pizza).';
