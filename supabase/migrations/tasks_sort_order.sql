-- ============================================================
-- Manuelle Reihenfolge für Aufgaben (Drag & Drop in Pipeline- und
-- Listenansicht auf /aufgaben). sort_order ist eine einzige globale
-- Ordnungsachse pro Task; jede Reorder-Operation im Frontend arbeitet
-- immer auf der kompletten, venture-skalierten Task-Liste, die der
-- Client ohnehin schon im Speicher hält, und nummeriert sie komplett
-- neu durch. Backfill übernimmt die bisherige implizite Sortierung
-- (Fälligkeit, dann Erstellungsdatum) pro venture, damit der erste
-- Drag keinen visuellen Sprung verursacht.
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY venture
    ORDER BY due_date NULLS LAST, created_at
  ) AS rn
  FROM tasks
)
UPDATE tasks
SET sort_order = ordered.rn - 1
FROM ordered
WHERE tasks.id = ordered.id;

CREATE INDEX IF NOT EXISTS tasks_venture_sort_order_idx ON tasks(venture, sort_order);
