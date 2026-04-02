-- Migration: Flexible payment models
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS payment_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture venture NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  steps JSONB NOT NULL DEFAULT '[]',
  payment_method TEXT DEFAULT 'invoice',
  payment_term_days INT DEFAULT 14,
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one default per venture
CREATE UNIQUE INDEX IF NOT EXISTS payment_models_venture_default
  ON payment_models (venture) WHERE (is_default = true);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_model_id UUID REFERENCES payment_models(id),
  ADD COLUMN IF NOT EXISTS payment_steps JSONB DEFAULT '[]';

-- Standardmodelle
INSERT INTO payment_models (venture, name, description, is_default, steps, payment_method, payment_term_days)
VALUES
(
  'online_first',
  '50/50 Standard',
  'Anzahlung bei Auftragserteilung, Restzahlung nach Abnahme',
  true,
  '[
    {"step":1,"label":"Anzahlung","percentage":50,"trigger":"auftragserteilung","due_days":0},
    {"step":2,"label":"Restzahlung","percentage":50,"trigger":"abnahme","due_days":7}
  ]',
  'invoice', 14
),
(
  'brandary',
  'Vorkasse Standard',
  '100% vor Produktionsbeginn',
  true,
  '[
    {"step":1,"label":"Vorkasse","percentage":100,"trigger":"auftragserteilung","due_days":7}
  ]',
  'prepayment', 7
),
(
  'worknest',
  'Rechnung nach Abschluss',
  'Kompletter Betrag nach Projektabschluss',
  true,
  '[
    {"step":1,"label":"Rechnung","percentage":100,"trigger":"abgeschlossen","due_days":30}
  ]',
  'invoice', 30
),
(
  'droplane',
  'Creator Auszahlung',
  'Monatliche Auszahlung an Creator',
  true,
  '[
    {"step":1,"label":"Auszahlung","percentage":100,"trigger":"monatlich","due_days":0}
  ]',
  'payout', 0
),
(
  'blazed_outfitters',
  'WooCommerce Direktzahlung',
  'Automatisch via WooCommerce abgewickelt',
  true,
  '[
    {"step":1,"label":"Direktzahlung","percentage":100,"trigger":"bestellung","due_days":0}
  ]',
  'woocommerce', 0
)
ON CONFLICT DO NOTHING;
