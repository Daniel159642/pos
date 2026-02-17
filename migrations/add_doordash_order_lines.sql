-- Store DoorDash line_item_id and line_option_id per order for Merchant Order Adjustment API.
-- Populated when we create an order from the DoorDash webhook; used when sending PATCH .../orders/{id}/adjustment.

CREATE TABLE IF NOT EXISTS doordash_order_lines (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    line_item_id TEXT,
    line_option_id TEXT,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_doordash_order_lines_order_id ON doordash_order_lines(order_id);
COMMENT ON TABLE doordash_order_lines IS 'DoorDash adjustment: line_item_id (main item) and line_option_id (modifier) from order payload for PATCH .../orders/{id}/adjustment.';
