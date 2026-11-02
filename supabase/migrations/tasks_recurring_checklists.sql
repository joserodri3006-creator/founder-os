-- Aufgaben: manuelle Reihenfolge, wiederkehrende Aufgaben und Checklisten.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT CHECK (recurrence_rule IN ('daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_parent_task_idx ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_sort_order_idx ON tasks(venture, sort_order);
