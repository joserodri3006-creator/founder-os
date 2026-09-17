-- Credit note (Gutschrift/Einnahmeminderung) fields for completed returns,
-- needed for bookkeeping when a refund reduces revenue.
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS credit_note_number TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_html TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_generated_at TIMESTAMPTZ;
