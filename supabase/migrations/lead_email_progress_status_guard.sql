-- Harte DB-Regel: Status "follow_up" oder "nachgefasst" darf nur zusammen mit einem
-- frischen last_contacted_at gesetzt werden (Beweis eines gerade erfolgten Mail-Versands).
-- Das schließt jede App-seitige Umgehung (PATCH-Route, Jarvis-Tool, Edge Function,
-- direkter SQL-Zugriff, künftiger Code) strukturell aus statt nur einzelne Endpunkte zu prüfen.

CREATE OR REPLACE FUNCTION enforce_lead_email_progress_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('follow_up', 'nachgefasst')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    IF NEW.last_contacted_at IS NULL
       OR NEW.last_contacted_at IS NOT DISTINCT FROM OLD.last_contacted_at
       OR NEW.last_contacted_at < (now() - interval '2 minutes')
    THEN
      RAISE EXCEPTION 'status % erfordert einen gerade erfolgten E-Mail-Versand (last_contacted_at muss in diesem Update aktualisiert werden)', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_lead_email_progress_status ON leads;
CREATE TRIGGER trg_enforce_lead_email_progress_status
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lead_email_progress_status();
