-- ============================================================
-- Private OS WhatsApp On-Demand Sync Control
-- Queues manual short sync/history attempts from the dashboard so a local
-- worker can start the WhatsApp bridge only temporarily.
-- ============================================================

CREATE TABLE IF NOT EXISTS private_os_whatsapp_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL DEFAULT 'sync'
                  CHECK (action IN ('sync', 'history_sync', 'stop')),
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'done', 'error', 'cancelled')),
  params          JSONB NOT NULL DEFAULT '{}'::jsonb,
  result          JSONB NOT NULL DEFAULT '{}'::jsonb,
  error           TEXT,
  queued_by       UUID,
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS private_os_whatsapp_sync_runs_status_idx
  ON private_os_whatsapp_sync_runs(status, queued_at ASC);
CREATE INDEX IF NOT EXISTS private_os_whatsapp_sync_runs_latest_idx
  ON private_os_whatsapp_sync_runs(queued_at DESC);

ALTER TABLE private_os_whatsapp_sync_runs DISABLE ROW LEVEL SECURITY;
