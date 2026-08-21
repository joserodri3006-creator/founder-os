-- ============================================================
-- Erweitert tasks.status von 2 Werten (open/done) auf 3 Werte
-- für die neue Pipeline/Kanban-Ansicht: open -> in_progress -> done.
-- Der ursprüngliche CHECK wurde inline in CREATE TABLE definiert
-- (kein expliziter Name) — Postgres hat ihn automatisch benannt.
-- Wir suchen den tatsächlichen Constraint-Namen dynamisch über
-- pg_constraint/pg_attribute (Spalten-Referenz, nicht Name), statt
-- ihn zu hardcoden: ein falscher Name bei DROP CONSTRAINT IF EXISTS
-- würde still no-open und den alten 2-Werte-Constraint stehen lassen.
-- Da bestehende Zeilen nur 'open'/'done' enthalten (Teilmenge der
-- neuen 3 Werte), ist kein Daten-Backfill nötig; Indizes sind von
-- der Wertemenge unabhängig und brauchen keine Änderung.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel       ON rel.oid = con.conrelid
    JOIN pg_namespace nsp   ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'tasks'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'  -- check constraint
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS colnum
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = colnum
        WHERE att.attname = 'status'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('open', 'in_progress', 'done'));

-- Verifikation nach dem Ausführen (optional, manuell im Supabase SQL Editor):
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.tasks'::regclass AND contype = 'c';
