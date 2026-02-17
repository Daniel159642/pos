-- DoorDash Integrated Promotions: store promotion breakdown for reconciliation.
-- applied_discounts_details (order-level) and item-level promo details; totals for merchant- and DoorDash-funded.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'doordash_promo_details'
  ) THEN
    ALTER TABLE orders ADD COLUMN doordash_promo_details JSONB;
    COMMENT ON COLUMN orders.doordash_promo_details IS 'DoorDash Integrated Promotions: applied_discounts_details, applied_item_discount_details, funding breakdown.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'doordash_total_merchant_funded_discount_cents'
  ) THEN
    ALTER TABLE orders ADD COLUMN doordash_total_merchant_funded_discount_cents INTEGER;
    COMMENT ON COLUMN orders.doordash_total_merchant_funded_discount_cents IS 'Total merchant-funded promo discount (cents) for reconciliation.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'doordash_total_doordash_funded_discount_cents'
  ) THEN
    ALTER TABLE orders ADD COLUMN doordash_total_doordash_funded_discount_cents INTEGER;
    COMMENT ON COLUMN orders.doordash_total_doordash_funded_discount_cents IS 'Total DoorDash-funded promo discount (cents).';
  END IF;
END $$;
