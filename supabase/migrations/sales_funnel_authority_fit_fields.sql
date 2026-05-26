-- Qualification fields for the Authority Website Sprint project-fit form.
-- Additive follow-up for installations that already applied sales_funnel.sql.

ALTER TABLE sales_submissions
  ADD COLUMN IF NOT EXISTS offer_description TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS offer_price_range TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_channel TEXT,
  ADD COLUMN IF NOT EXISTS website_status TEXT,
  ADD COLUMN IF NOT EXISTS funnel_preference TEXT,
  ADD COLUMN IF NOT EXISTS assets_status TEXT,
  ADD COLUMN IF NOT EXISTS budget_readiness TEXT,
  ADD COLUMN IF NOT EXISTS biggest_challenge TEXT;
