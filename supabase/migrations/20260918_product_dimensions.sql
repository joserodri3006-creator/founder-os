-- Adds physical dimensions to products for shipping/display purposes.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS depth_cm NUMERIC(8,2);
