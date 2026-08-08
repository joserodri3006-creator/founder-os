-- ============================================================
-- Return Classes + Tracking Carrier
-- ============================================================

-- 1. Retoureklassen-Tabelle
CREATE TABLE IF NOT EXISTS return_classes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  venture     venture     NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  cost        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Produkte: FK auf Retoureklasse
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS return_class_id UUID
    REFERENCES return_classes(id) ON DELETE SET NULL;

-- 3. Aufträge: Carrier-Feld für automatische Tracking-URL
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;

-- RLS
ALTER TABLE return_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_classes_select" ON return_classes;
DROP POLICY IF EXISTS "return_classes_modify" ON return_classes;

CREATE POLICY "return_classes_select" ON return_classes
  FOR SELECT USING (true);

CREATE POLICY "return_classes_modify" ON return_classes
  FOR ALL USING (true);
