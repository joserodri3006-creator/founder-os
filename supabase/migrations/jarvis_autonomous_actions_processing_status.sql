-- Erlaubt den atomaren Zwischenstatus "processing" für jarvis_autonomous_actions.
-- Wird von PATCH /api/jarvis/aktionen genutzt, um eine Freigabe-Aktion per
-- bedingtem UPDATE (status=pending -> status=processing) atomar zu claimen,
-- bevor die eigentliche Mail versendet wird. Verhindert Doppelversand bei
-- gleichzeitigen/doppelten Freigabe-Requests (Doppelklick, zwei offene Tabs).

ALTER TABLE jarvis_autonomous_actions DROP CONSTRAINT IF EXISTS jarvis_autonomous_actions_status_check;

ALTER TABLE jarvis_autonomous_actions
  ADD CONSTRAINT jarvis_autonomous_actions_status_check
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'executed', 'failed'));
