import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Muss 1:1 zur Tabellen-Allowlist der `report_reader`-Rolle in
// supabase/migrations/reporting.sql passen. Neue Tabellen hier UND dort ergänzen.
const SCHEMA_DESCRIPTION = `
Verfügbare Tabellen (Postgres, Schema "public"). Nur diese Tabellen/Spalten verwenden.
Enum "venture": 'online_first' | 'blazed_outfitters' | 'droplane' | 'brandary'.

leads (Lead-Pipeline aller Ventures)
  id, venture, first_name, last_name, email, phone, company_name, website, city, region,
  industry, source (website|linkedin|empfehlung|kaltakquise|csv_import|ki_suche),
  status (neu|in_bearbeitung|kontaktiert|follow_up|nachgefasst|erstgespraech|qualifiziert|
    sales_gespraech|angebot_gesendet|gewonnen|verloren|nachfassen_zukunft),
  review_status, lead_potential, contact_channel, next_action,
  follow_up_date, archived_at, created_at, updated_at

lead_activities (Aktivitäten pro Lead)
  id, lead_id, activity_type, from_status, to_status, description, created_at

lead_tags (id, venture, name) · lead_tag_map (lead_id, tag_id)

customers (Kundenstamm aller Ventures)
  id, venture, first_name, last_name, company_name, email, phone, city, street,
  postal_code, country, customer_type (b2c|b2b), status (active|pending|inactive),
  discount_rate, notes, archived_at, created_at

customer_tags (id, venture, name) · customer_tag_map (customer_id, tag_id)

orders (Aufträge aller Ventures)
  id, venture, customer_id, title, description, package_type, value (NUMERIC, Auftragswert),
  status (neu|bezahlt|briefing|in_bearbeitung|in_produktion|versendet|review|abgeschlossen|
    nachbetreuung|storniert|pausiert|angebot_gesendet),
  deadline, invoice_number, invoice_generated_at, invoice_sent,
  payment_model_id, payment_steps (JSONB), anzahlung_betrag, anzahlung_erhalten,
  restzahlung_erhalten, checkout_source, notes, archived_at, created_at

order_activities (Aktivitäten/Audit-Trail pro Auftrag)
  id, order_id, activity_type, from_status, to_status, description, created_at

order_items (Bestellpositionen)
  id, order_id, product_id, product_name, sku, quantity, unit_price, created_at

returns (Retouren)
  id, order_id, venture, status (requested|approved|rejected|completed), reason,
  refund_amount, refund_method, requested_at, processed_at

products (Produkte aller Ventures)
  id, venture, product_type_id, brand_id, name, sku, price, compare_at_price, cost_price,
  status (draft|active|archived), is_featured, track_inventory, weight, created_at, updated_at

product_variants (id, product_id, sku, price, stock)
product_categories (id, venture, name, slug, parent_id, level, path)
product_category_map (product_id, category_id)
product_tags (id, venture, name) · product_tag_map (product_id, tag_id)

payment_models (id, venture, name, is_default, payment_method, payment_term_days, currency)

tax_classes (id, venture, name, is_default)
tax_rates (id, tax_class_id, country, rate)
`.trim();
// Hinweis: sales_submissions/sales_checkout_sessions/project_briefings (Online-First
// Sales-Funnel) sind erst nutzbar, sobald supabase/migrations/sales_funnel.sql in
// Produktion ausgeführt wurde. Danach hier ergänzen UND reporting.sql erneut ausführen,
// damit report_reader auch dort SELECT-Rechte bekommt.

const FORBIDDEN_SQL = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|call|do|vacuum|execute|lock|comment\s+on|pg_sleep|pg_terminate_backend|dblink|lo_import|lo_export)\b/i;

function validateSelectOnly(sql: string): string | null {
  const trimmed = sql.trim();
  if (trimmed.length === 0 || trimmed.length > 4000) return "Query leer oder zu lang";
  if (!/^(select|with)\s/i.test(trimmed)) return "Nur SELECT-Abfragen sind erlaubt";
  if (trimmed.includes(";")) return "Mehrfach-Statements sind nicht erlaubt";
  if (/(--|\/\*)/.test(trimmed)) return "SQL-Kommentare sind nicht erlaubt";
  if (FORBIDDEN_SQL.test(trimmed)) return "Query enthält ein nicht erlaubtes Schlüsselwort";
  return null;
}

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API Fehler (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let question: string;
  let venture: string | undefined;
  try {
    const body = await req.json();
    question = body.question;
    venture = body.venture || undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return new Response(JSON.stringify({ error: "question fehlt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const system = `Du bist ein SQL-Generator für ein Postgres-Reporting-Tool ("Founder OS").
Deine einzige Aufgabe: aus einer deutschsprachigen Freitext-Frage EINE einzelne,
gültige PostgreSQL-SELECT-Abfrage generieren, die die Frage beantwortet.

${SCHEMA_DESCRIPTION}

Regeln:
- Nutze AUSSCHLIESSLICH die oben gelisteten Tabellen und Spalten.
- Genau EIN SELECT- oder WITH-Statement, kein Semikolon, keine SQL-Kommentare.
- Niemals INSERT/UPDATE/DELETE/DDL — nur Lesen.
- Wenn die Frage einen Venture nennt oder ein Venture-Kontext mitgegeben ist, filtere darauf.
- Bei Aggregationen (Anzahl, Summe, Durchschnitt) aussagekräftige deutsche Spalten-Aliase verwenden.
- Begrenze offene Listen sinnvoll (z.B. ORDER BY ... LIMIT 50), wenn die Frage keine feste Menge nennt.
- Wenn die Frage nicht mit den verfügbaren Daten beantwortbar ist, generiere trotzdem eine bestmögliche
  Annäherung und erkläre die Einschränkung im "explanation"-Feld.

Antworte NUR mit einem JSON-Objekt, ohne Markdown, ohne Erklärungen davor/danach:
{"sql": "<die SQL-Abfrage>", "explanation": "<1-2 Sätze auf Deutsch, was die Abfrage macht>"}`;

  const user = venture
    ? `Frage: ${question}\n\nAktiver Venture-Kontext (falls relevant, sonst ignorieren): ${venture}`
    : `Frage: ${question}`;

  let generated: { sql: string; explanation: string };
  try {
    const raw = await callClaude(system, user);
    generated = JSON.parse(raw);
  } catch (e) {
    console.error("SQL-Generierung fehlgeschlagen:", e);
    return new Response(JSON.stringify({ error: "SQL-Generierung fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validationError = validateSelectOnly(generated.sql ?? "");
  if (validationError) {
    return new Response(
      JSON.stringify({ error: validationError, sql: generated.sql }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.rpc("execute_report_query", { query_text: generated.sql });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, sql: generated.sql, explanation: generated.explanation }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rows = Array.isArray(data) ? data : [];
  return new Response(
    JSON.stringify({
      sql: generated.sql,
      explanation: generated.explanation,
      row_count: rows.length,
      rows,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
