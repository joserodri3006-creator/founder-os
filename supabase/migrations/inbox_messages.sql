-- ============================================================
-- E-Mail-Inbox-Integration: eingehende Venture-Mails als
-- System-of-Record, verknüpft mit leads/customers/suppliers
-- per E-Mail-Match.
-- ============================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  venture           venture     NOT NULL,
  account_id        TEXT        NOT NULL,
  account_email     TEXT        NOT NULL,
  folder            TEXT        NOT NULL DEFAULT 'INBOX',
  provider          TEXT        NOT NULL CHECK (provider IN ('imap', 'gmail')),

  message_uid       TEXT        NOT NULL,
  message_id        TEXT,
  thread_key        TEXT,
  in_reply_to       TEXT,
  references_header TEXT,

  from_email        TEXT        NOT NULL,
  from_name         TEXT,
  to_emails         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  cc_emails         JSONB       NOT NULL DEFAULT '[]'::jsonb,

  subject           TEXT,
  body_preview      TEXT,
  body_text         TEXT,

  has_attachments   BOOLEAN     NOT NULL DEFAULT false,
  attachment_names  JSONB       NOT NULL DEFAULT '[]'::jsonb,

  received_at       TIMESTAMPTZ NOT NULL,

  lead_id           UUID        REFERENCES leads(id) ON DELETE SET NULL,
  customer_id       UUID        REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id       UUID        REFERENCES suppliers(id) ON DELETE SET NULL,

  match_status      TEXT        NOT NULL DEFAULT 'unmatched'
                    CHECK (match_status IN (
                      'matched_lead',
                      'matched_customer',
                      'matched_supplier',
                      'unmatched'
                    )),

  created_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE (account_email, folder, message_uid),
  CHECK (
    (match_status = 'matched_lead'     AND lead_id IS NOT NULL     AND customer_id IS NULL     AND supplier_id IS NULL) OR
    (match_status = 'matched_customer' AND customer_id IS NOT NULL AND lead_id IS NULL         AND supplier_id IS NULL) OR
    (match_status = 'matched_supplier' AND supplier_id IS NOT NULL AND lead_id IS NULL         AND customer_id IS NULL) OR
    (match_status = 'unmatched'        AND lead_id IS NULL         AND customer_id IS NULL     AND supplier_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS inbox_messages_venture_idx      ON inbox_messages(venture);
CREATE INDEX IF NOT EXISTS inbox_messages_account_idx      ON inbox_messages(account_email, folder);
CREATE INDEX IF NOT EXISTS inbox_messages_lead_idx         ON inbox_messages(lead_id);
CREATE INDEX IF NOT EXISTS inbox_messages_customer_idx     ON inbox_messages(customer_id);
CREATE INDEX IF NOT EXISTS inbox_messages_supplier_idx     ON inbox_messages(supplier_id);
CREATE INDEX IF NOT EXISTS inbox_messages_match_status_idx ON inbox_messages(match_status);
CREATE INDEX IF NOT EXISTS inbox_messages_received_at_idx  ON inbox_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS inbox_messages_from_email_idx   ON inbox_messages(from_email);
CREATE INDEX IF NOT EXISTS inbox_messages_thread_key_idx   ON inbox_messages(thread_key);

-- App-Zugriff läuft wie bei tasks/attachments über die service-role
-- (proxy.ts prüft Section-Permissions serverseitig), kein RLS nötig.
ALTER TABLE inbox_messages DISABLE ROW LEVEL SECURITY;
