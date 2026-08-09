-- ============================================================
-- Konfigurierbare E-Mail-Vorlagen (venture-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  venture      TEXT        NOT NULL,
  template_key TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  intro_text   TEXT        NOT NULL,
  footer_text  TEXT        NOT NULL,
  from_name    TEXT        NOT NULL DEFAULT 'ITABA',
  from_email   TEXT        NOT NULL DEFAULT 'onboarding@resend.dev',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (venture, template_key)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
DROP POLICY IF EXISTS "email_templates_modify" ON email_templates;

CREATE POLICY "email_templates_select" ON email_templates FOR SELECT USING (true);
CREATE POLICY "email_templates_modify" ON email_templates FOR ALL    USING (true);
