-- Itaba: unbezahlte Abholreservierungen mit Ablaufdatum
-- Die Migration ist additiv und verändert bestehende Zahlungsabläufe nicht.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'reserviert' AFTER 'neu';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'offen',
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('offen', 'bezahlt', 'storniert'));

CREATE INDEX IF NOT EXISTS orders_itaba_reservation_expiry_idx
  ON orders (reservation_expires_at)
  WHERE venture = 'itaba'
    AND status = 'reserviert'
    AND reservation_expires_at IS NOT NULL;
