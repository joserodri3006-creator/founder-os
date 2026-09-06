import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

function tableMissing(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("private_os_whatsapp_sync_runs");
}

export async function GET() {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { data: latest, error: latestError } = await supabaseAdmin
    .from("private_os_whatsapp_sync_runs")
    .select("*")
    .order("queued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    if (tableMissing(latestError)) {
      return NextResponse.json({
        configured: false,
        bridge_status: "not_migrated",
        message: "WhatsApp-Control-Tabelle ist noch nicht migriert.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: latestError.message }, { status: 500 });
  }

  const { count: queuedCount, error: queuedError } = await supabaseAdmin
    .from("private_os_whatsapp_sync_runs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running"]);

  if (queuedError) return NextResponse.json({ error: queuedError.message }, { status: 500 });

  const bridgeStatus = latest?.status === "running"
    ? "running"
    : latest?.status === "queued"
      ? "queued"
      : "stopped";

  return NextResponse.json({
    configured: true,
    bridge_status: bridgeStatus,
    queued_or_running: queuedCount ?? 0,
    latest_run: latest ?? null,
    read_receipts: false,
    note: "WhatsApp läuft nicht dauerhaft; Dashboard-Buttons legen On-Demand-Runs für den lokalen Worker an.",
  });
}
