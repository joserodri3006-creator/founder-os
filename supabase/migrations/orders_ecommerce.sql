-- ============================================================
-- E-Commerce Erweiterungen für Aufträge / Bestellungen
-- ============================================================

-- 1. Neue Status-Werte im Enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'bezahlt'   AFTER 'neu';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'versendet' AFTER 'in_produktion';

-- 2. Bestellpositionen (Artikel pro Auftrag)
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID           REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT           NOT NULL,
  sku          TEXT,
  quantity     INT            NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ    DEFAULT NOW() NOT NULL
);

-- 3. Retourenverwaltung
CREATE TABLE IF NOT EXISTS returns (
  id             UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id       UUID           REFERENCES orders(id) ON DELETE SET NULL,
  venture        TEXT           NOT NULL,
  status         TEXT           NOT NULL DEFAULT 'requested'
                                CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  reason         TEXT,
  items          JSONB,
  customer_email TEXT,
  customer_name  TEXT,
  refund_amount  NUMERIC(10, 2),
  refund_method  TEXT,
  notes          TEXT,
  requested_at   TIMESTAMPTZ    DEFAULT NOW() NOT NULL,
  processed_at   TIMESTAMPTZ
);

-- RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_modify" ON order_items;
DROP POLICY IF EXISTS "returns_select"     ON returns;
DROP POLICY IF EXISTS "returns_modify"     ON returns;

CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (true);
CREATE POLICY "order_items_modify" ON order_items FOR ALL    USING (true);
CREATE POLICY "returns_select"     ON returns     FOR SELECT USING (true);
CREATE POLICY "returns_modify"     ON returns     FOR ALL    USING (true);
