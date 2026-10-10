import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateMcpKey, unauthorizedResponse } from "@/lib/mcp-auth";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

const ALLOWED_VENTURES = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"];
const ALLOWED_SOURCES  = ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"];

// ── POST /api/mcp/leads/batch ─────────────────────────────────────────────────
// Legt bis zu 50 Leads auf einmal an. Fehler in einzelnen Leads stoppen nicht
// den Rest — gibt eine genaue Zusammenfassung zurück.
export async function POST(req: NextRequest) {
  if (!validateMcpKey(req)) return unauthorizedResponse();

  const body = await req.json();
  const leads: unknown[] = Array.isArray(body.leads) ? body.leads : [];

  if (leads.length === 0) {
    return NextResponse.json({ error: "leads-Array ist leer oder fehlt" }, { status: 400 });
  }
  if (leads.length > 50) {
    return NextResponse.json({ error: "Maximal 50 Leads pro Batch-Aufruf" }, { status: 400 });
  }

  type Result = {
    index: number;
    status: "created" | "duplicate" | "error";
    lead_id: string | null;
    email: string;
    company_name: string | null;
    error: string | null;
  };

  const results: Result[] = [];
  let createdCount  = 0;
  let dupeCount     = 0;
  let errorCount    = 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  for (let i = 0; i < leads.length; i++) {
    const item = leads[i] as Record<string, unknown>;
    const email       = ((item.email ?? "") as string).toLowerCase().trim();
    const firstName   = ((item.first_name ?? "") as string).trim();
    const lastName    = ((item.last_name  ?? "") as string).trim();
    const venture     = (item.venture as string) ?? "";
    const companyName = ((item.company_name ?? "") as string).trim() || null;

    // Validierung
    if (!firstName || !lastName) {
      results.push({ index: i, status: "error", lead_id: null, email, company_name: companyName, error: "first_name und last_name erforderlich" });
      errorCount++;
      continue;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ index: i, status: "error", lead_id: null, email, company_name: companyName, error: "Ungültige E-Mail-Adresse" });
      errorCount++;
      continue;
    }
    if (!ALLOWED_VENTURES.includes(venture)) {
      results.push({ index: i, status: "error", lead_id: null, email, company_name: companyName, error: `venture '${venture}' ungültig` });
      errorCount++;
      continue;
    }

    // Duplikat-Check
    const { data: existing } = await supabaseAdmin
      .from("leads").select("id").eq("email", email).eq("venture", venture).maybeSingle();

    const payload = {
      venture,
      first_name:         firstName,
      last_name:          lastName,
      email,
      phone:              ((item.phone ?? "") as string).trim() || null,
      company_name:       companyName,
      website:            ((item.website ?? "") as string).trim() || null,
      city:               ((item.city ?? "") as string).trim() || null,
      region:             ((item.region ?? "Hessen") as string).trim() || "Hessen",
      industry:           ((item.industry ?? "") as string).trim() || null,
      contact_reason:     ((item.contact_reason ?? "") as string).trim() || null,
      notes:              ((item.notes ?? "") as string).trim() || null,
      source:             ALLOWED_SOURCES.includes(item.source as string) ? item.source as string : "ki_suche",
      status:             "neu" as const,
      automation_enabled: item.automation_enabled !== false,
      is_duplicate:       Boolean(existing),
    };

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert(payload)
      .select("id")
      .single();

    if (error || !lead) {
      results.push({ index: i, status: "error", lead_id: null, email, company_name: companyName, error: error?.message ?? "Insert fehlgeschlagen" });
      errorCount++;
      continue;
    }

    // KI-Qualifizierung anstoßen (non-blocking)
    if (!existing && supabaseUrl && serviceKey) {
      void fetch(`${supabaseUrl}/functions/v1/lead-qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ lead_id: lead.id }),
      });
    }

    if (existing) {
      dupeCount++;
      results.push({ index: i, status: "duplicate", lead_id: lead.id, email, company_name: companyName, error: null });
    } else {
      createdCount++;
      results.push({ index: i, status: "created", lead_id: lead.id, email, company_name: companyName, error: null });
    }
  }

  return NextResponse.json(
    {
      created:    createdCount,
      duplicates: dupeCount,
      errors:     errorCount,
      total:      leads.length,
      results,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
