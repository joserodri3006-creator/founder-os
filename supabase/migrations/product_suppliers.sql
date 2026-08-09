-- ============================================================
-- Interne Nummer + Lieferanten
-- ============================================================

-- 1. Interne Nummer auf Produkte
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS internal_number TEXT;

-- 2. Lieferanten-Tabelle (venture-scoped)
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  venture       venture     NOT NULL,
  name          TEXT        NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Produkt ↔ Lieferant (n:m)
CREATE TABLE IF NOT EXISTS product_supplier_map (
  product_id      UUID REFERENCES products(id)   ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id)  ON DELETE CASCADE,
  purchase_price  NUMERIC(10, 2),
  lead_time_days  INT,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  PRIMARY KEY (product_id, supplier_id)
);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_supplier_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select"         ON suppliers;
DROP POLICY IF EXISTS "suppliers_modify"         ON suppliers;
DROP POLICY IF EXISTS "product_supplier_select"  ON product_supplier_map;
DROP POLICY IF EXISTS "product_supplier_modify"  ON product_supplier_map;

CREATE POLICY "suppliers_select"        ON suppliers            FOR SELECT USING (true);
CREATE POLICY "suppliers_modify"        ON suppliers            FOR ALL    USING (true);
CREATE POLICY "product_supplier_select" ON product_supplier_map FOR SELECT USING (true);
CREATE POLICY "product_supplier_modify" ON product_supplier_map FOR ALL    USING (true);
