-- ============================================================
-- PRODUCT MANAGEMENT — Founder OS
-- Stand: 2026-04-07
-- ============================================================

-- Storage Bucket (run in Supabase Dashboard → Storage if not via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: public read
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Storage Policy: authenticated upload
CREATE POLICY "Authenticated upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Storage Policy: authenticated delete
CREATE POLICY "Authenticated delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- ============================================================
-- PRODUCT TYPES (konfigurierbar pro Venture)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture           venture NOT NULL,
  name              TEXT NOT NULL,
  has_variants      BOOLEAN DEFAULT false,
  has_inventory     BOOLEAN DEFAULT false,
  has_weight        BOOLEAN DEFAULT false,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Standard-Typen
INSERT INTO product_types (venture, name, has_variants, has_inventory, has_weight, sort_order) VALUES
  ('online_first',      'Website-Paket',    false, false, false, 1),
  ('online_first',      'SEO-Paket',        false, false, false, 2),
  ('online_first',      'Wartungsvertrag',  false, false, false, 3),
  ('blazed_outfitters', 'T-Shirt',          true,  true,  true,  1),
  ('blazed_outfitters', 'Hoodie',           true,  true,  true,  2),
  ('blazed_outfitters', 'Accessoire',       true,  true,  true,  3),
  ('brandary',          'Textildruck',      true,  true,  true,  1),
  ('brandary',          'Werbemittel',      true,  true,  false, 2),
  ('brandary',          'Verpackung',       true,  true,  false, 3),
  ('droplane',          'Creator-Package',  false, false, false, 1),
  ('droplane',          'Digital-Produkt',  false, false, false, 2),
  ('worknest',          'SaaS-Plan',        false, false, false, 1),
  ('worknest',          'Add-on',           false, false, false, 2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture     venture NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CATEGORIES (hierarchisch)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture     venture NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT,
  parent_id   UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_tags (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture   venture NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE(venture, name)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture             venture NOT NULL,
  product_type_id     UUID REFERENCES product_types(id) ON DELETE SET NULL,
  brand_id            UUID REFERENCES product_brands(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  slug                TEXT,
  description         TEXT,
  short_description   TEXT,
  sku                 TEXT,
  price               NUMERIC(10,2),
  compare_at_price    NUMERIC(10,2),
  cost_price          NUMERIC(10,2),
  status              TEXT DEFAULT 'draft', -- draft | active | archived
  is_featured         BOOLEAN DEFAULT false,
  track_inventory     BOOLEAN DEFAULT false,
  weight              NUMERIC(8,3),
  images              JSONB DEFAULT '[]',
  -- [{url, storage_path, alt, sort_order}]
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_venture_idx ON products(venture);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PRODUCT ↔ CATEGORY (m:n)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_category_map (
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- ============================================================
-- PRODUCT ↔ TAG (m:n)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_tag_map (
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- ============================================================
-- VARIANT OPTIONS (z.B. "Größe" → ["S","M","L","XL"])
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variant_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- z.B. "Größe", "Farbe"
  values      JSONB NOT NULL DEFAULT '[]', -- ["S","M","L"]
  sort_order  INT DEFAULT 0
);

-- ============================================================
-- PRODUCT VARIANTS (konkrete SKUs)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID REFERENCES products(id) ON DELETE CASCADE,
  sku               TEXT,
  price             NUMERIC(10,2),
  compare_at_price  NUMERIC(10,2),
  cost_price        NUMERIC(10,2),
  stock_quantity    INT DEFAULT 0,
  option_values     JSONB DEFAULT '{}', -- {"Größe":"M","Farbe":"Schwarz"}
  image_url         TEXT,
  weight            NUMERIC(8,3),
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS variants_product_idx ON product_variants(product_id);

-- ============================================================
-- INVENTORY MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture         venture NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL, -- in | out | adjustment | return
  quantity        INT NOT NULL,  -- positiv = Eingang, negativ = Ausgang
  stock_before    INT,
  stock_after     INT,
  reference_type  TEXT,  -- order | purchase | manual | return
  reference_id    UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_product_idx ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS inventory_variant_idx ON inventory_movements(variant_id);

-- Auto-update stock_quantity on variant when movement inserted
CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    SELECT stock_quantity INTO NEW.stock_before
      FROM product_variants WHERE id = NEW.variant_id;
    UPDATE product_variants
      SET stock_quantity = stock_quantity + NEW.quantity
      WHERE id = NEW.variant_id;
    NEW.stock_after := NEW.stock_before + NEW.quantity;
  ELSIF NEW.product_id IS NOT NULL THEN
    -- Für Produkte ohne Varianten
    SELECT COALESCE((metadata->>'stock_quantity')::int, 0) INTO NEW.stock_before
      FROM products WHERE id = NEW.product_id;
    UPDATE products
      SET metadata = jsonb_set(
        metadata,
        '{stock_quantity}',
        to_jsonb(COALESCE((metadata->>'stock_quantity')::int, 0) + NEW.quantity)
      )
      WHERE id = NEW.product_id;
    NEW.stock_after := NEW.stock_before + NEW.quantity;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movement_trigger
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();
