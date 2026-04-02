import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VENTURES = ["online_first", "blazed_outfitters", "droplane", "brandary", "worknest"] as const;

function groupByVenture(rows: { venture: string }[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const v of VENTURES) result[v] = 0;
  for (const row of rows) {
    if (row.venture in result) result[row.venture]++;
  }
  return result;
}

export async function GET() {
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
    supabaseAdmin.from("leads").select("venture").gte("created_at", weekAgo).is("archived_at", null),
    supabaseAdmin.from("leads").select("venture").eq("ai_draft_approved", false).not("ai_draft_subject", "is", null).is("archived_at", null),
    supabaseAdmin.from("orders").select("venture").neq("status", "abgeschlossen"),
    supabaseAdmin.from("customers").select("venture").gte("created_at", monthStart),
    supabaseAdmin.from("leads").select("id,first_name,last_name,email,company_name,status,source,created_at,venture").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("leads").select("*", { count: "exact", head: true }).lte("follow_up_date", today).not("follow_up_date", "is", null).is("archived_at", null),
  ]);

  const byLeadsWeek = groupByVenture(leadsWeek ?? []);
  const byOpenDrafts = groupByVenture(openDrafts ?? []);
  const byActiveOrders = groupByVenture(activeOrders ?? []);
  const byNewCustomers = groupByVenture(newCustomers ?? []);

  const ventureKpis = VENTURES.map((v) => ({
    venture: v,
    leadsWeek: byLeadsWeek[v] ?? 0,
    openDrafts: byOpenDrafts[v] ?? 0,
    activeOrders: byActiveOrders[v] ?? 0,
    newCustomers: byNewCustomers[v] ?? 0,
  }));

  return NextResponse.json({
    ventureKpis,
    followUpsFaellig: followUpsFaellig ?? 0,
    recentLeads: recentLeads ?? [],
  });
}
