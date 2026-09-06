import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

/**
 * POST /api/private-os/whatsapp/sync
 * 
 * Queue a WhatsApp sync job (on-demand, manual trigger).
 * Only founder can trigger.
 * 
 * Body:
 *   {
 *     "action": "sync" | "history_sync" | "stop",
 *     "params": { "history_days": 2, "timeout_seconds": 120 } // optional
 *   }
 * 
 * Returns:
 *   { "run_id": "uuid", "status": "queued", "action": "sync", ... }
 */
export async function POST(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { action = "sync", params = {} } = body;

  const validActions = ["sync", "history_sync", "stop"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("private_os_whatsapp_sync_runs")
      .insert({
        action,
        status: "queued",
        params: params || {},
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
      queued_at: data.queued_at,
      message: `WhatsApp ${action} job queued. Local worker should pick this up shortly.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/private-os/whatsapp/sync?limit=10
 * 
 * List recent WhatsApp sync runs.
 */
export async function GET(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

  try {
    const { data, error } = await supabaseAdmin
      .from("private_os_whatsapp_sync_runs")
      .select("*")
      .order("queued_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
