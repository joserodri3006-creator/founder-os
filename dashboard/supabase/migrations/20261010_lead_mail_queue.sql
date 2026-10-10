-- lead_mail_queue: Persistente Outbound-Mail-Queue für Hermes SMTP-Worker
-- Dashboard stellt Mails hier ein, lokaler Hermes-Worker versendet per SMTP
-- und aktualisiert danach den Lead-Datensatz.

CREATE TABLE IF NOT EXISTS lead_mail_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    venture         TEXT NOT NULL,
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    from_email      TEXT NOT NULL,
    from_name       TEXT NOT NULL,
    to_email        TEXT NOT NULL,
    to_name         TEXT,
    reply_to        TEXT,
    subject         TEXT NOT NULL,
    body_text       TEXT NOT NULL,
    is_ai_draft     BOOLEAN NOT NULL DEFAULT false,
    -- queued: wartet auf Worker | sending: Worker arbeitet dran
    -- sent: erfolgreich versendet | error: fehlgeschlagen
    status          TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sending','sent','error')),
    queued_by       TEXT,           -- z.B. 'dashboard' oder User-ID
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lead_mail_queue_status  ON lead_mail_queue(status);
CREATE INDEX IF NOT EXISTS idx_lead_mail_queue_lead_id ON lead_mail_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_mail_queue_created ON lead_mail_queue(created_at);

-- RLS aktivieren: Lesen für eingeloggte User (Dashboard-Anzeige der Queue)
ALTER TABLE lead_mail_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_mail_queue' AND policyname = 'lead_mail_queue_select'
  ) THEN
    CREATE POLICY lead_mail_queue_select ON lead_mail_queue
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END$$;
