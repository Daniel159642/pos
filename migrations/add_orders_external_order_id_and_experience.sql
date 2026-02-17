-- Store DoorDash/Shopify external order id for: cancellation webhooks, order ready, merchant cancel to platform
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id TEXT;
-- Experience flag from DoorDash: DOORDASH, CAVIAR, STOREFRONT (for merchant display)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS integration_experience TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id) WHERE external_order_id IS NOT NULL;
