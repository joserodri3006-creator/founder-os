-- ============================================================
-- FINANZEN — Lexware-Erfassungsstatus pro Vorkommen
-- Stand: 2026-10-03
-- ============================================================

ALTER TABLE finance_entry_occurrences
  ADD COLUMN IF NOT EXISTS lexware_erfasst BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN finance_entry_occurrences.lexware_erfasst IS 'Ob diese Buchung bereits in Lexware erfasst wurde (unabhängig vom Zahlstatus).';
