import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const PERIODS = new Set(["week", "month", "quarter", "year"]);

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const venture = params.get("venture");
  const period = params.get("period") ?? "month";
  const asOf = params.get("as_of") ?? new Date().toISOString().slice(0, 10);

  if (!venture) return NextResponse.json({ error: "venture parameter required" }, { status: 400 });
  if (!PERIODS.has(period)) return NextResponse.json({ error: "invalid period" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return NextResponse.json({ error: "invalid as_of date" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { data, error } = await supabase.rpc("dashboard_venture_summary", {
    p_venture: venture,
    p_period: period,
    p_as_of: asOf,
  });

  if (error) {
    console.error("dashboard_venture_summary:", error.message);
    const status = /permission|zugriff|auth/i.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Kein Zugriff auf dieses Venture" : "Dashboard konnte nicht geladen werden" }, { status });
  }

  return NextResponse.json(data);
}
