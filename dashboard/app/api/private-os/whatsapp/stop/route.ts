import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

export async function POST() {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from("private_os_whatsapp_sync_runs")
    .insert({
      action: "stop",
      status: "queued",
      params: {},
      queued_by: auth.user.id,
    })
    .select("id, action, status, queued_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, run: data });
}
