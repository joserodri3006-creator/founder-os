-- Blazed Outfitters Review & Reputation MVP
-- Founder OS remains the system of record. Public access only via tokenized API routes.

CREATE TABLE IF NOT EXISTS review_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture venture NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_name TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  review_type TEXT NOT NULL DEFAULT 'order' CHECK (review_type IN ('service','order')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','opened','completed','expired','cancelled')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS review_invitation_order_type_unique
  ON review_invitations(order_id, review_type)
  WHERE order_id IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS review_invitations_venture_status_idx
  ON review_invitations(venture, status, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture venture NOT NULL,
  invitation_id UUID NOT NULL UNIQUE REFERENCES review_invitations(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL DEFAULT 'order' CHECK (review_type IN ('service','order')),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  category_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  author_name TEXT,
  author_display_name TEXT NOT NULL DEFAULT 'Verifizierter Kunde',
  public_consent BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','flagged','rejected')),
  source TEXT NOT NULL DEFAULT 'founder_os' CHECK (source IN ('founder_os','manual','google','trustpilot')),
  moderation_reason TEXT,
  response_text TEXT,
  response_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  response_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_public_venture_idx
  ON reviews(venture, published_at DESC)
  WHERE status = 'published' AND public_consent = true;
CREATE INDEX IF NOT EXISTS reviews_moderation_idx
  ON reviews(venture, status, submitted_at DESC);

ALTER TABLE review_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- No authenticated/anon table policies on purpose. Internal and public review
-- operations are mediated by server routes using the service role, with explicit
-- permissions or a one-time invitation token.

COMMENT ON TABLE review_invitations IS 'Neutral review invitations linked to verified Founder OS customers/orders.';
COMMENT ON TABLE reviews IS 'Verified first-party reviews. Publication requires consent and founder moderation.';
