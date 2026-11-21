-- Aufgaben-Anhänge und dauerhafte Wiederholungen
-- Nach Ausführung können Anhänge auch an tasks gebunden werden.

-- Die bestehende attachments-Tabelle erlaubt bisher order/customer/product.
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
ALTER TABLE attachments
  ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN ('order', 'customer', 'product', 'task'));

CREATE INDEX IF NOT EXISTS idx_attachments_task
  ON attachments(entity_id)
  WHERE entity_type = 'task';

-- Wiederholung ohne recurrence_end_date ist bewusst dauerhaft.
COMMENT ON COLUMN tasks.recurrence_end_date IS
  'Optionales Enddatum für Wiederholungen. NULL bedeutet dauerhafte Wiederholung.';
