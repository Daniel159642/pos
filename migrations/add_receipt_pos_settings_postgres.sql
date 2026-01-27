-- Add receipt_settings and pos_settings tables for PostgreSQL (replaces SQLite)

CREATE TABLE IF NOT EXISTS receipt_settings (
    id SERIAL PRIMARY KEY,
    receipt_type TEXT DEFAULT 'traditional' CHECK(receipt_type IN ('traditional', 'custom')),
    store_name TEXT DEFAULT 'Store',
    store_address TEXT DEFAULT '',
    store_city TEXT DEFAULT '',
    store_state TEXT DEFAULT '',
    store_zip TEXT DEFAULT '',
    store_phone TEXT DEFAULT '',
    store_email TEXT DEFAULT '',
    store_website TEXT DEFAULT '',
    footer_message TEXT DEFAULT 'Thank you for your business!',
    return_policy TEXT DEFAULT '',
    show_tax_breakdown INTEGER DEFAULT 1 CHECK(show_tax_breakdown IN (0, 1)),
    show_payment_method INTEGER DEFAULT 1 CHECK(show_payment_method IN (0, 1)),
    show_signature INTEGER DEFAULT 0 CHECK(show_signature IN (0, 1)),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM receipt_settings LIMIT 1) THEN
    INSERT INTO receipt_settings (receipt_type, store_name, footer_message, show_tax_breakdown, show_payment_method)
    VALUES ('traditional', 'Store', 'Thank you for your business!', 1, 1);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pos_settings (
    id SERIAL PRIMARY KEY,
    num_registers INTEGER DEFAULT 1,
    register_type TEXT DEFAULT 'one_screen',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pos_settings LIMIT 1) THEN
    INSERT INTO pos_settings (num_registers, register_type) VALUES (1, 'one_screen');
  END IF;
END $$;
