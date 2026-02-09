-- Add order_source to orders for third-party channels (e.g. doordash, shopify)
-- Values: 'doordash', 'shopify', or NULL for in-house orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT;
