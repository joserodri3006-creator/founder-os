-- Itaba: offline Kassenverkauf bei Abholung dokumentieren.
-- Der Abschluss erzeugt weder Online-Zahlung noch Rechnung.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS offline_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS offline_payment_reference TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_offline_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_offline_payment_method_check
  CHECK (
    offline_payment_method IS NULL
    OR offline_payment_method IN ('bar', 'karte', 'sonstige')
  );

NOTIFY pgrst, 'reload schema';