-- ============================================================
-- AUTH & PERMISSIONS — Founder OS
-- Stand: 2026-04-08
-- ============================================================

-- Einladungen (noch nicht angenommen)
CREATE TABLE IF NOT EXISTS user_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  venture       venture,          -- NULL = Founder (alle Ventures)
  role          TEXT NOT NULL DEFAULT 'employee', -- founder | manager | employee
  permissions   JSONB NOT NULL DEFAULT '{}',
  -- {"leads":"edit","customers":"view","orders":"edit","products":"edit","drafts":"none","invoices":"none","settings":"none"}
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Aktive Berechtigungen (nach Annahme der Einladung)
CREATE TABLE IF NOT EXISTS user_venture_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venture       venture,          -- NULL = alle Ventures (Founder)
  role          TEXT NOT NULL DEFAULT 'employee',
  permissions   JSONB NOT NULL DEFAULT '{}',
  invited_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, venture)
);

-- Founder automatisch eintragen (jose.rodri3006@gmail.com)
-- Wird ausgeführt nachdem sich der Founder das erste Mal einloggt
-- via Trigger auf auth.users

CREATE OR REPLACE FUNCTION auto_assign_founder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'jose.rodri3006@gmail.com' THEN
    INSERT INTO user_venture_roles (user_id, venture, role, permissions)
    VALUES (
      NEW.id,
      NULL,  -- NULL = alle Ventures
      'founder',
      '{"leads":"edit","customers":"edit","orders":"edit","products":"edit","drafts":"edit","invoices":"edit","settings":"edit"}'::jsonb
    )
    ON CONFLICT (user_id, venture) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_assign_founder();
