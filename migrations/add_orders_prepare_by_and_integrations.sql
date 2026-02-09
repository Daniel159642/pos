-- Prepare-by time for integration orders (when order should be ready)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepare_by TIMESTAMP WITH TIME ZONE;

-- Integrations: Shopify, DoorDash, Uber Eats (API keys, webhook secrets, custom pricing per site)
CREATE TABLE IF NOT EXISTS pos_integrations (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(establishment_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_pos_integrations_establishment ON pos_integrations(establishment_id);

COMMENT ON TABLE pos_integrations IS 'Third-party order source config: shopify, doordash, uber_eats. config: api_key, secret, store_url, price_multiplier, etc.';
