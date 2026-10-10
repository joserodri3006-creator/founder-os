import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateMcpKey, unauthorizedResponse } from "@/lib/mcp-auth";

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization" },
  });
}

// ── GET /api/mcp/stats ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!validateMcpKey(req)) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  if (!venture) return NextResponse.json({ error: "venture erforderlich" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("status,source,is_duplicate")
    .eq("venture", venture)
    .is("archived_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = data ?? [];

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
  }

  return NextResponse.json({
    total:      leads.length,
    won:        byStatus["gewonnen"]  ?? 0,
    lost:       byStatus["verloren"]  ?? 0,
    duplicates: leads.filter(l => l.is_duplicate).length,
    by_status:  byStatus,
    by_source:  bySource,
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
