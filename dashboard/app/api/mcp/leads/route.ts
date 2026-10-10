import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateMcpKey, unauthorizedResponse } from "@/lib/mcp-auth";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// ── GET /api/mcp/leads ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!validateMcpKey(req)) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const venture  = searchParams.get("venture");
  const status   = searchParams.get("status");
  const industry = searchParams.get("industry");
  const lastContacted = searchParams.get("last_contacted");
  const search   = searchParams.get("search")?.trim();
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  if (!venture) {
    return NextResponse.json({ error: "venture Parameter ist erforderlich" }, { status: 400 });
  }

  const SEARCH_COLUMNS = [
    "first_name", "last_name", "email", "company_name",
    "phone", "website", "city", "region", "industry", "notes",
  ];

  let query = supabaseAdmin
    .from("leads")
    .select(
      "id,venture,first_name,last_name,email,company_name,phone,website," +
      "city,region,industry,notes,contact_reason,source,status," +
      "last_contacted_at,follow_up_date,ai_draft_subject,is_duplicate," +
      "automation_enabled,created_at,updated_at"
    )
    .eq("venture", venture)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status)   query = query.eq("status", status);
  if (industry) query = query.eq("industry", industry);
  if (search) {
    const term = search.replace(/[%,]/g, "");
    query = query.or(SEARCH_COLUMNS.map(c => `${c}.ilike.%${term}%`).join(","));
  }
  if (lastContacted === "never") {
    query = query.is("last_contacted_at", null);
  } else if (lastContacted === "7d") {
    const d = new Date(); d.setDate(d.getDate() - 7);
    query = query.gte("last_contacted_at", d.toISOString());
  } else if (lastContacted === "30d") {
    const d = new Date(); d.setDate(d.getDate() - 30);
    query = query.gte("last_contacted_at", d.toISOString());
  } else if (lastContacted === "older_30d") {
    const d = new Date(); d.setDate(d.getDate() - 30);
    query = query.lt("last_contacted_at", d.toISOString()).not("last_contacted_at", "is", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? [], {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

// ── POST /api/mcp/leads ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!validateMcpKey(req)) return unauthorizedResponse();

  const body = await req.json();

  const ALLOWED_VENTURES = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"];
  const ALLOWED_SOURCES  = ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"];

  const firstName = (body.first_name ?? "").trim();
  const lastName  = (body.last_name  ?? "").trim();
  const email     = (body.email      ?? "").toLowerCase().trim();
  const venture   = body.venture;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "first_name und last_name sind erforderlich" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse erforderlich" }, { status: 400 });
  }
  if (!ALLOWED_VENTURES.includes(venture)) {
    return NextResponse.json(
      { error: `venture muss einer von: ${ALLOWED_VENTURES.join(", ")} sein` },
      { status: 400 }
    );
  }

  // Duplikat-Check
  const { data: existing } = await supabaseAdmin
    .from("leads").select("id").eq("email", email).eq("venture", venture).maybeSingle();

  const payload = {
    venture,
    first_name:         firstName,
    last_name:          lastName,
    email,
    phone:              body.phone?.trim()          || null,
    company_name:       body.company_name?.trim()   || null,
    website:            body.website?.trim()         || null,
    city:               body.city?.trim()            || null,
    region:             body.region?.trim()          || "Hessen",
    industry:           body.industry?.trim()        || null,
    contact_reason:     body.contact_reason?.trim()  || null,
    notes:              body.notes?.trim()           || null,
    source:             ALLOWED_SOURCES.includes(body.source) ? body.source : "ki_suche",
    status:             "neu" as const,
    automation_enabled: body.automation_enabled ?? true,
    is_duplicate:       Boolean(existing),
  };

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert(payload)
    .select("id,venture,first_name,last_name,email,company_name,status,source,is_duplicate,created_at")
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Lead konnte nicht angelegt werden" }, { status: 500 });
  }

  // KI-Qualifizierung anstoßen (non-blocking)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!existing && supabaseUrl && serviceKey) {
    void fetch(`${supabaseUrl}/functions/v1/lead-qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ lead_id: lead.id }),
    });
  }

  return NextResponse.json(
    { success: true, lead, duplicate: Boolean(existing) },
    { status: 201, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
