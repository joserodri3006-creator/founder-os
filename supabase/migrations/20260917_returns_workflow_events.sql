-- Retoure workflow audit trail and operational fields

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS return_shipping_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS refund_gross_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS return_label_attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_label_url TEXT,
  ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS return_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  venture TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_events_return_idx ON return_events(return_id, created_at DESC);

ALTER TABLE return_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_events_select" ON return_events;
DROP POLICY IF EXISTS "return_events_modify" ON return_events;
CREATE POLICY "return_events_select" ON return_events FOR SELECT USING (true);
CREATE POLICY "return_events_modify" ON return_events FOR ALL USING (true);
