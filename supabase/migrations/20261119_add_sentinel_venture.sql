-- Sentinel als eigenes Founder-OS-Venture registrieren.
-- Das Projekt bleibt fachlich ein client_project, erhält im Founder OS aber
-- einen eigenen Venture-Kontext für Manager, Aufgaben und Filter.
-- Die Enum-Erweiterung muss vor den Inserts committed sein; bei Ausführung
-- im Supabase SQL Editor daher zuerst diese Datei ausführen, danach die
-- Manager-/Portfolio-Schritte ausführen.

ALTER TYPE venture ADD VALUE IF NOT EXISTS 'sentinel';
