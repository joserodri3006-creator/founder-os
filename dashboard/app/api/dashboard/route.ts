import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");

  if (!venture) {
    return NextResponse.json({ error: "venture parameter required" }, { status: 400 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().split("T")[0];

  const [
    { data: leadsWeek },
    { data: openDrafts },
    { data: activeOrders },
    { data: newCustomers },
    { data: recentLeads },
    { count: followUpsFaellig },
  ] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("id")
      .eq("venture", venture)
      .gte("created_at", weekAgo)
      .is("archived_at", null),

    supabaseAdmin
      .from("leads")
      .select("id")
      .eq("venture", venture)
      .eq("ai_draft_approved", false)
      .not("ai_draft_subject", "is", null)
      .is("archived_at", null),

    supabaseAdmin
      .from("orders")
      .select("id")
      .eq("venture", venture)
      .neq("status", "abgeschlossen"),

    supabaseAdmin
      .from("customers")
      .select("id")
      .eq("venture", venture)
      .gte("created_at", monthStart),

    supabaseAdmin
      .from("leads")
      .select("id,first_name,last_name,email,company_name,status,source,created_at,venture")
      .eq("venture", venture)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(10),

    supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("venture", venture)
      .lte("follow_up_date", today)
      .not("follow_up_date", "is", null)
      .is("archived_at", null),
  ]);

  return NextResponse.json({
    kpi: {
      leadsWeek:     (leadsWeek ?? []).length,
      openDrafts:    (openDrafts ?? []).length,
      activeOrders:  (activeOrders ?? []).length,
      newCustomers:  (newCustomers ?? []).length,
    },
    followUpsFaellig: followUpsFaellig ?? 0,
    recentLeads:      recentLeads ?? [],
  });
}
