-- ============================================================
-- FINANZEN — Einnahmen/Ausgaben pro Venture, einmalig & wiederkehrend,
-- mit Partner-Zahlungsanteilen (geteilte Kosten)
-- Stand: 2026-10-03
-- ============================================================

-- Haupttabelle: eine Zeile pro Buchung (Vorlage bei wiederkehrenden Einträgen)
CREATE TABLE IF NOT EXISTS finance_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture         venture NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('einnahme', 'ausgabe')),
  description     TEXT NOT NULL,
  category        TEXT,
  account         TEXT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
  entry_date      DATE NOT NULL,       -- Fälligkeits-/Buchungsdatum (einmalig) bzw. Startdatum (wiederkehrend)
  paid_date       DATE,                -- tatsächliches Zahlungsdatum, sobald status = 'bezahlt'
  is_recurring    BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval TEXT CHECK (recurrence_interval IN ('monatlich', 'quartalsweise', 'jaehrlich')),
  recurrence_end_date DATE,            -- optional, NULL = unbefristet
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,  -- optionale Verknüpfung zu einem Auftrag
  notes           TEXT,
  created_by      UUID,                -- auth.users.id des Erfassers
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_entries_venture_idx ON finance_entries(venture);
CREATE INDEX IF NOT EXISTS finance_entries_entry_date_idx ON finance_entries(entry_date);
CREATE INDEX IF NOT EXISTS finance_entries_type_idx ON finance_entries(type);
CREATE INDEX IF NOT EXISTS finance_entries_status_idx ON finance_entries(status);
CREATE INDEX IF NOT EXISTS finance_entries_order_idx ON finance_entries(order_id);

-- Generierte Vorkommen wiederkehrender Buchungen auf der Monatsachse.
-- Für nicht-wiederkehrende Buchungen gibt es genau ein Vorkommen = die Buchung selbst
-- (wird per Trigger/App-Logik gespiegelt), damit Summenbildung einheitlich über
-- diese Tabelle läuft, unabhängig davon ob einmalig oder wiederkehrend.
CREATE TABLE IF NOT EXISTS finance_entry_occurrences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES finance_entries(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,       -- konkretes Datum dieses Vorkommens (für Monats-/Jahressicht)
  amount          NUMERIC(12,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
  paid_date       DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entry_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS finance_occurrences_date_idx ON finance_entry_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS finance_occurrences_entry_idx ON finance_entry_occurrences(entry_id);
CREATE INDEX IF NOT EXISTS finance_occurrences_status_idx ON finance_entry_occurrences(status);

-- Partner-Zahlungsanteile: wer hat wie viel von einer Buchung getragen/eingezahlt.
-- Analog zum bestehenden Partner-Ledger-Muster (z.B. 50/50-Kostenteilung).
CREATE TABLE IF NOT EXISTS finance_entry_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES finance_entries(id) ON DELETE CASCADE,
  occurrence_id   UUID REFERENCES finance_entry_occurrences(id) ON DELETE CASCADE, -- optional: Anteil für ein konkretes Vorkommen statt der ganzen Buchung
  partner_name    TEXT NOT NULL,       -- Name des Partners/Teammitglieds (frei, kein User-Zwang)
  partner_user_id UUID,                -- optionale Verknüpfung zu auth.users, falls vorhanden
  share_amount    NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0),  -- vereinbarter Anteil
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0), -- tatsächlich schon eingezahlt/bezahlt
  paid_date       DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_shares_entry_idx ON finance_entry_shares(entry_id);
CREATE INDEX IF NOT EXISTS finance_shares_occurrence_idx ON finance_entry_shares(occurrence_id);

-- Freitext-Kategorien pro Venture, aber ohne feste Liste erzwungen zu bekommen:
-- einfache Vorschlagsliste aus bereits genutzten Werten, DISTINCT-Abfrage reicht aus,
-- keine eigene Lookup-Tabelle nötig (Konsistenz mit "Kategorie als Freitext" Vorgabe).

COMMENT ON TABLE finance_entries IS 'Finanzbuchungen (Einnahmen/Ausgaben) pro Venture, einmalig oder wiederkehrend.';
COMMENT ON TABLE finance_entry_occurrences IS 'Konkrete Monats-Vorkommen jeder Buchung — Basis für Monats-/Jahressummen.';
COMMENT ON TABLE finance_entry_shares IS 'Partner-Zahlungsanteile pro Buchung (wer hat wie viel eingezahlt/bezahlt).';
