import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({})) as {
    mode?: "sync" | "history_sync";
    duration_seconds?: number;
    history_days?: number;
    store_untracked?: boolean;
    include_groups?: boolean;
  };

  const action = body.mode === "history_sync" ? "history_sync" : "sync";
  const params = {
    duration_seconds: clamp(Number(body.duration_seconds ?? (action === "history_sync" ? 90 : 45)) || 45, 10, 180),
    history_days: action === "history_sync" ? clamp(Number(body.history_days ?? 2) || 2, 1, 7) : undefined,
    store_untracked: body.store_untracked === true,
    include_groups: body.include_groups === true,
  };

  const { data, error } = await supabaseAdmin
    .from("private_os_whatsapp_sync_runs")
    .insert({
      action,
      status: "queued",
      params,
      queued_by: auth.user.id,
    })
    .select("id, action, status, params, queued_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, run: data });
}
