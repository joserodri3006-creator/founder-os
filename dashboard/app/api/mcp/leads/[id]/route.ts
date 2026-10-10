import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateMcpKey, unauthorizedResponse } from "@/lib/mcp-auth";

type Params = { params: Promise<{ id: string }> };

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function OPTIONS() {
  return new Response(null, {
    headers: { ...CORS, "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" },
  });
}

// ── GET /api/mcp/leads/[id] ───────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  if (!validateMcpKey(req)) return unauthorizedResponse();
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id,venture,first_name,last_name,email,company_name,phone,website,city,region,industry,notes,contact_reason,source,status,last_contacted_at,follow_up_date,ai_draft_subject,ai_draft_body,is_duplicate,automation_enabled,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  return NextResponse.json(data, { headers: CORS });
}

// ── PATCH /api/mcp/leads/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!validateMcpKey(req)) return unauthorizedResponse();
  const { id } = await params;

  const body = await req.json();

  // Nur erlaubte Felder — Status-Änderungen laufen über den normalen Prozess
  const PATCHABLE = ["notes", "industry", "company_name", "website", "city", "phone",
                     "contact_reason", "region", "automation_enabled"] as const;

  const update: Record<string, unknown> = {};
  for (const key of PATCHABLE) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Keine patchbaren Felder übergeben" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true }, { headers: CORS });
}
