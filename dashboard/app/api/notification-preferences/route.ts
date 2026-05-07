import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const EVENT_TYPES = [
  { key: "new_lead",             label: "Neuer Lead" },
  { key: "follow_up_due",        label: "Follow-up fällig" },
  { key: "draft_ready",          label: "KI-Draft bereit" },
  { key: "order_status_changed", label: "Auftragsstatus geändert" },
  { key: "payment_due",          label: "Zahlung fällig" },
  { key: "ki_search_done",       label: "KI-Suche abgeschlossen" },
  { key: "sync_failed",          label: "WooCommerce-Sync Fehler" },
  { key: "invoice_not_sent",     label: "Rechnung nicht versendet" },
] as const;

// GET /api/notification-preferences?venture=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const venture = new URL(req.url).searchParams.get("venture");
  if (!venture) return NextResponse.json({ error: "venture required" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .eq("venture", venture);

  const existing = new Map((data ?? []).map((r: any) => [r.event_type, r]));
  const result = EVENT_TYPES.map((et) => {
    const pref = existing.get(et.key);
    return {
      event_type: et.key,
      label:      et.label,
      in_app:     pref ? pref.in_app : true,
      email:      pref ? pref.email  : false,
    };
  });

  return NextResponse.json({ preferences: result });
}

// PUT /api/notification-preferences
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { venture, event_type, in_app, email } = await req.json();
  if (!venture || !event_type) return NextResponse.json({ error: "venture + event_type required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert({
      user_id:    user.id,
      venture,
      event_type,
      in_app:     Boolean(in_app),
      email:      Boolean(email),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,venture,event_type" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
