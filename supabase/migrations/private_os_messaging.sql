-- ============================================================
-- Private OS Messaging Inbox
-- Instagram-first, WhatsApp-compatible data model.
-- Stores only opted-in/tracked conversations; outbound/destructive
-- provider actions are queued for a local worker and require explicit UI action.
-- ============================================================

CREATE TABLE IF NOT EXISTS private_os_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
  label               TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  username            TEXT,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS private_os_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
  provider_contact_id TEXT NOT NULL,
  display_name        TEXT,
  username            TEXT,
  avatar_url          TEXT,
  is_tracked          BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_contact_id)
);

CREATE TABLE IF NOT EXISTS private_os_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
  account_id         UUID REFERENCES private_os_accounts(id) ON DELETE SET NULL,
  contact_id         UUID REFERENCES private_os_contacts(id) ON DELETE SET NULL,
  provider_thread_id TEXT NOT NULL,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived', 'muted')),
  is_group           BOOLEAN NOT NULL DEFAULT false,
  last_message_at    TIMESTAMPTZ,
  last_message_text  TEXT,
  unread_count       INTEGER NOT NULL DEFAULT 0,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_thread_id)
);

CREATE TABLE IF NOT EXISTS private_os_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
  thread_id           UUID NOT NULL REFERENCES private_os_threads(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES private_os_contacts(id) ON DELETE SET NULL,
  provider_message_id TEXT NOT NULL,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_provider_id  TEXT,
  sender_name         TEXT,
  body_text           TEXT,
  media               JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at             TIMESTAMPTZ,
  received_at         TIMESTAMPTZ NOT NULL,
  remote_deleted_at   TIMESTAMPTZ,
  local_deleted_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_message_id)
);

CREATE TABLE IF NOT EXISTS private_os_message_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT NOT NULL CHECK (provider IN ('instagram', 'whatsapp')),
  thread_id           UUID REFERENCES private_os_threads(id) ON DELETE CASCADE,
  message_id          UUID REFERENCES private_os_messages(id) ON DELETE SET NULL,
  action              TEXT NOT NULL CHECK (action IN ('reply', 'delete_remote', 'delete_local', 'archive_thread', 'mark_tracked')),
  status              TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  error               TEXT,
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS private_os_contacts_provider_tracked_idx ON private_os_contacts(provider, is_tracked);
CREATE INDEX IF NOT EXISTS private_os_threads_provider_last_idx ON private_os_threads(provider, last_message_at DESC);
CREATE INDEX IF NOT EXISTS private_os_threads_contact_idx ON private_os_threads(contact_id);
CREATE INDEX IF NOT EXISTS private_os_messages_thread_time_idx ON private_os_messages(thread_id, received_at ASC);
CREATE INDEX IF NOT EXISTS private_os_messages_provider_time_idx ON private_os_messages(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS private_os_message_actions_status_idx ON private_os_message_actions(status, queued_at ASC);

ALTER TABLE private_os_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE private_os_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE private_os_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE private_os_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE private_os_message_actions DISABLE ROW LEVEL SECURITY;
