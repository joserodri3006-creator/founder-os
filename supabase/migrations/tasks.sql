-- ============================================================
-- Aufgabenverwaltung: Aufgaben pro Lead/Kunde (Status, Priorität, Fälligkeit,
-- optionale Zuweisung an ein Teammitglied), plus globale Übersicht /aufgaben.
-- Polymorphes entity_type/entity_id-Muster analog zu `attachments`.
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venture      venture     NOT NULL,
  entity_type  TEXT        NOT NULL CHECK (entity_type IN ('lead', 'customer')),
  entity_id    UUID        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  priority     TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date     DATE,
  assigned_to  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_entity_idx      ON tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS tasks_venture_idx      ON tasks(venture);
CREATE INDEX IF NOT EXISTS tasks_status_due_idx   ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx  ON tasks(assigned_to);

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
