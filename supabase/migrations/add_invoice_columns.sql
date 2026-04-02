-- Migration: Add invoice columns to orders table
-- Run this in the Supabase SQL editor

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_html TEXT,
  ADD COLUMN IF NOT EXISTS invoice_data JSONB;
