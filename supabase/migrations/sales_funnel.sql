-- Online First automated sales funnel.
-- Additive migration: existing leads, customers, orders and payment workflows remain valid.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT,
  ADD COLUMN IF NOT EXISTS fit_status TEXT,
  ADD COLUMN IF NOT EXISTS fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attribution JSONB DEFAULT '{}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_source TEXT,
  ADD COLUMN IF NOT EXISTS briefing_token TEXT,
  ADD COLUMN IF NOT EXISTS briefing_completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_checkout_session_unique
  ON orders(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_briefing_token_unique
  ON orders(briefing_token)
  WHERE briefing_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture venture NOT NULL DEFAULT 'online_first',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  package_code TEXT NOT NULL DEFAULT 'leadgen_website_5_page',
  package_price_net_cents INTEGER NOT NULL DEFAULT 249000,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  website TEXT,
  profession TEXT,
  primary_goal TEXT NOT NULL,
  timeline TEXT NOT NULL,
  pages_required TEXT NOT NULL,
  needs_shop BOOLEAN NOT NULL DEFAULT false,
  needs_custom_features BOOLEAN NOT NULL DEFAULT false,
  content_ready BOOLEAN NOT NULL DEFAULT false,
  fit_score INTEGER NOT NULL,
  fit_status TEXT NOT NULL CHECK (fit_status IN ('checkout_ready', 'call_recommended', 'not_supported')),
  routing_reason TEXT NOT NULL,
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  privacy_consent_at TIMESTAMPTZ NOT NULL,
  marketing_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_submissions_created_idx ON sales_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS sales_submissions_lead_idx ON sales_submissions(lead_id);

CREATE TABLE IF NOT EXISTS sales_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES sales_submissions(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  checkout_url TEXT,
  stripe_payment_intent_id TEXT,
  amount_net_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'expired', 'failed')),
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  b2b_confirmed_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_checkout_lead_idx ON sales_checkout_sessions(lead_id);

CREATE TABLE IF NOT EXISTS consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES sales_submissions(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('privacy', 'marketing', 'terms', 'b2b_confirmation')),
  document_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS consent_events_submission_idx ON consent_events(submission_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS project_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  business_description TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  core_offer TEXT NOT NULL,
  primary_call_to_action TEXT NOT NULL,
  preferred_pages TEXT NOT NULL,
  visual_direction TEXT,
  existing_assets TEXT,
  domain_access TEXT,
  booking_link TEXT,
  additional_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_request_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_request_limits_lookup_idx
  ON public_request_limits(route, identifier_hash, created_at DESC);

ALTER TABLE sales_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_request_limits ENABLE ROW LEVEL SECURITY;
