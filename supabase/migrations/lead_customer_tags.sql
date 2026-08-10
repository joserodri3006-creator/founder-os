-- ============================================================
-- Stichwörter (Tags) für Leads und Kunden
-- Spiegelt das bestehende Muster von product_tags/product_tag_map
-- (siehe product_management.sql) 1:1 für zwei weitere Entitäten.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_tags (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture   venture NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE(venture, name)
);

CREATE TABLE IF NOT EXISTS lead_tag_map (
  lead_id   UUID REFERENCES leads(id) ON DELETE CASCADE,
  tag_id    UUID REFERENCES lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE IF NOT EXISTS customer_tags (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture   venture NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE(venture, name)
);

CREATE TABLE IF NOT EXISTS customer_tag_map (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES customer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);
