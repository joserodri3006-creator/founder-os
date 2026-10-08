-- Versandzeitpunkt für Bewertungseinladungen (Hermes-Worker versendet nach send_after)
ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS send_after TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS review_invitations_queue_idx
  ON review_invitations(send_after)
  WHERE status = 'pending' AND token_hash LIKE 'unissued:%';
