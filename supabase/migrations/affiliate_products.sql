-- Affiliate product management for Founder OS products.
-- Keeps affiliate products in the existing venture-scoped products table so
-- they can use categories, tags, notes, attachments and product list/detail UI.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS affiliate_network TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_merchant TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_url TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_commission_rate NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS affiliate_commission_type TEXT DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS affiliate_cookie_days INT,
  ADD COLUMN IF NOT EXISTS affiliate_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS affiliate_notes TEXT;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_source_type_check,
  DROP CONSTRAINT IF EXISTS products_affiliate_commission_type_check,
  DROP CONSTRAINT IF EXISTS products_affiliate_status_check;

ALTER TABLE products
  ADD CONSTRAINT products_source_type_check
    CHECK (source_type IN ('own', 'affiliate')),
  ADD CONSTRAINT products_affiliate_commission_type_check
    CHECK (affiliate_commission_type IN ('percent', 'fixed', 'unknown')),
  ADD CONSTRAINT products_affiliate_status_check
    CHECK (affiliate_status IN ('pending', 'active', 'paused', 'rejected'));

CREATE INDEX IF NOT EXISTS products_source_type_idx ON products(source_type);
CREATE INDEX IF NOT EXISTS products_affiliate_status_idx ON products(affiliate_status);
CREATE INDEX IF NOT EXISTS products_affiliate_network_idx ON products(affiliate_network);
