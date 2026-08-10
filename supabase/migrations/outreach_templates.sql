-- ============================================================
-- Anschreiben-Vorlagen: frei benennbare E-Mail-Vorlagen für den manuellen
-- Versand direkt aus Lead-/Kunden-Detailseiten (Dropdown + Platzhalter).
--
-- Bewusst getrennt von `email_templates`: jene Tabelle bedient feste
-- System-Events (ein Template pro `template_key`, automatisch ausgelöst
-- bei Status-Änderung/Versand/Storno). Hier dagegen beliebig viele frei
-- benannte Vorlagen pro Venture, die der Nutzer manuell auswählt.
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture    venture NOT NULL,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_templates_venture_idx ON outreach_templates(venture);

DROP TRIGGER IF EXISTS outreach_templates_updated_at ON outreach_templates;
CREATE TRIGGER outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
