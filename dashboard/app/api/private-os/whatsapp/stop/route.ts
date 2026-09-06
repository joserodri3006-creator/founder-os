import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

/**
 * POST /api/private-os/whatsapp/stop
 * 
 * Queue a WhatsApp bridge stop request.
 * Bridge will gracefully shut down any ongoing sync/listen.
 */
export async function POST(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("private_os_whatsapp_sync_runs")
      .insert({
        action: "stop",
        status: "queued",
        params: {},
        queued_by: auth.user?.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      run_id: data.id,
      status: data.status,
      action: data.action,
      message: "WhatsApp bridge stop queued. Bridge will gracefully shutdown in a moment.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
