-- ============================================================
-- PRODUCT LOCATIONS — Lagerorte (konfigurierbare Hierarchie pro Venture)
-- Stand: 2026-09-28
-- ============================================================

CREATE TABLE IF NOT EXISTS product_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture     venture NOT NULL,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES product_locations(id) ON DELETE SET NULL,
  sort_order  INT DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_locations_venture_idx ON product_locations(venture);
CREATE INDEX IF NOT EXISTS product_locations_parent_idx ON product_locations(parent_id);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES product_locations(id) ON DELETE SET NULL;
