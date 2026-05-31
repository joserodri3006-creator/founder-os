-- Lead review workflow for manually researched Google leads.
-- Additive migration: existing lead, draft and order workflows remain valid.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'reviewed', 'ready_for_outreach', 'blocked')),
  ADD COLUMN IF NOT EXISTS lead_potential TEXT
    CHECK (lead_potential IN ('a_potential', 'b_potential', 'not_fit')),
  ADD COLUMN IF NOT EXISTS contact_channel TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (contact_channel IN ('unchecked', 'email_ok', 'phone_better', 'linkedin_better', 'do_not_contact')),
  ADD COLUMN IF NOT EXISTS next_action TEXT NOT NULL DEFAULT 'website_pruefen'
    CHECK (next_action IN ('website_pruefen', 'linkedin_pruefen', 'erstansprache_vorbereiten', 'fit_check_senden', 'nachfassen', 'archivieren')),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_review_status_idx ON leads(review_status);
CREATE INDEX IF NOT EXISTS leads_next_action_idx ON leads(next_action);
