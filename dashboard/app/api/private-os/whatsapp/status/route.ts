import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

export type WhatsAppStatus = {
  configured: boolean;
  bridge_status: "connected" | "disconnected" | "error";
  message?: string;
  last_sync_at?: string;
  next_sync_in?: string;
  note?: string;
};

/**
 * GET /api/private-os/whatsapp/status
 * 
 * Get WhatsApp bridge and sync status.
 */
export async function GET(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  try {
    // Check for latest sync run
    const { data: syncRuns, error: syncError } = await supabaseAdmin
      .from("private_os_whatsapp_sync_runs")
      .select("*")
      .order("queued_at", { ascending: false })
      .limit(1);

    const lastRun = syncRuns?.[0];
    const status: WhatsAppStatus = {
      configured: process.env.WHATSAPP_ENABLED === "true",
      bridge_status: "disconnected", // TODO: probe actual bridge health
      message: lastRun ? `Last run: ${lastRun.action} (${lastRun.status})` : "No sync runs yet",
      last_sync_at: lastRun?.started_at || undefined,
      note: "WhatsApp-Bridge läuft temporär auf Abruf. Längere Sync-Fenster werden automatisch beendet.",
    };

    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { configured: false, bridge_status: "error", note: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
