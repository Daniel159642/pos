-- Add unit_price (sale/retail price) to pending_shipment_items so user-edited price
-- is stored and used when adding the product to inventory (product_price).
-- unit_cost remains the cost; unit_price is the selling price.
ALTER TABLE pending_shipment_items
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

COMMENT ON COLUMN pending_shipment_items.unit_price IS 'Optional sale/retail price; used as product_price when creating inventory.';
