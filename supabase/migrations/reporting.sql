-- ============================================================
-- Reporting: NL→SQL "Selektion" — abgesicherte Read-Only-Ausführung
--
-- Zwei Verteidigungsebenen:
-- 1) Anwendungsseitig (Edge Function reporting-query) validiert die von
--    Claude generierte SQL grob (nur SELECT/WITH, kein Semikolon, kein
--    Blocklist-Keyword) bevor sie überhaupt hierher geschickt wird.
-- 2) Datenbankseitig (diese Migration): eine dedizierte Rolle
--    `report_reader` bekommt AUSSCHLIESSLICH SELECT-Rechte auf eine
--    kuratierte Tabellen-Allowlist. execute_report_query() gehört dieser
--    Rolle (SECURITY DEFINER + Ownership statt SET ROLE — Postgres
--    verbietet SET ROLE innerhalb SECURITY-DEFINER-Funktionen), führt
--    die generierte SQL also physisch nur mit report_reader-Rechten aus.
--    BYPASSRLS ist nötig, weil leads/customers/orders RLS aktiviert haben,
--    aber report_reader kein `authenticated`/`service_role`-Kontext ist,
--    für den es dort Policies gibt — Zeilenfilterung übernimmt weiterhin
--    die Tabellen-Allowlist selbst (kein Grant = kein Zugriff), BYPASSRLS
--    hebt nur die zusätzliche Policy-Ebene innerhalb erlaubter Tabellen auf.
--
-- Idempotent und sicher erneut ausführbar, z.B. nachdem eine neue Tabelle
-- (z.B. nach sales_funnel.sql) zur Allowlist unten ergänzt wurde.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_reader') THEN
    CREATE ROLE report_reader NOLOGIN;
  END IF;
END $$;

ALTER ROLE report_reader BYPASSRLS;

-- Der ausführende Admin-User braucht SET-Mitgliedschaft (nicht nur
-- ADMIN/CREATEROLE), um unten per SET ROLE als report_reader zu agieren.
GRANT report_reader TO CURRENT_USER WITH SET TRUE;

GRANT USAGE ON SCHEMA public TO report_reader;

-- Kuratierte Allowlist an Business-Tabellen. Neue Tabellen bekommen NIE
-- automatisch Zugriff — bewusst explizit ergänzen, wenn gewünscht.
-- Über to_regclass() abgesichert: Tabellen aus noch nicht ausgeführten
-- Migrationen (z.B. sales_funnel.sql → sales_submissions) werden übersprungen
-- statt die gesamte Migration fehlschlagen zu lassen. Nach Ausführung von
-- sales_funnel.sql dieses Skript erneut laufen lassen, um die dortigen
-- Tabellen zu ergänzen (und SCHEMA_DESCRIPTION in reporting-query/index.ts).
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads', 'customers', 'orders', 'order_items', 'returns',
    'order_activities', 'lead_activities',
    'products', 'product_variants', 'product_categories', 'product_category_map',
    'product_tags', 'product_tag_map',
    'lead_tags', 'lead_tag_map', 'customer_tags', 'customer_tag_map',
    'payment_models',
    'tax_classes', 'tax_rates',
    'sales_submissions', 'sales_checkout_sessions', 'project_briefings'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON %I TO report_reader', tbl);
    ELSE
      RAISE NOTICE 'Tabelle % existiert noch nicht — Grant übersprungen', tbl;
    END IF;
  END LOOP;
END $$;

-- CREATE OR REPLACE auf eine bereits von report_reader besessene Funktion
-- verlangt trotzdem CREATE auf dem Schema — nur transient gewähren.
GRANT CREATE ON SCHEMA public TO report_reader;
SET ROLE report_reader;

CREATE OR REPLACE FUNCTION execute_report_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  result JSONB;
  normalized TEXT := lower(trim(query_text));
BEGIN
  IF normalized !~ '^(select|with)\s' THEN
    RAISE EXCEPTION 'Nur SELECT-Abfragen sind erlaubt';
  END IF;
  IF query_text ~ ';' THEN
    RAISE EXCEPTION 'Mehrfach-Statements sind nicht erlaubt';
  END IF;
  IF query_text ~ '(--|/\*)' THEN
    RAISE EXCEPTION 'SQL-Kommentare sind nicht erlaubt';
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT * FROM (%s) sub LIMIT 500) t',
    query_text
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION execute_report_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_report_query(TEXT) TO service_role;

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM report_reader;
