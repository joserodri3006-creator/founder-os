/**
 * send-notification — Shared Helper Edge Function
 *
 * Wird von anderen Edge Functions aufgerufen um Notifications zu erstellen.
 * Prüft notification_preferences pro User und legt notifications-Einträge an.
 *
 * POST Body:
 * {
 *   venture:    string
 *   event_type: string
 *   title:      string
 *   body?:      string
 *   link?:      string
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rollen die welche Events bekommen
const ROLE_MAP: Record<string, string[]> = {
  new_lead:             ["owner", "admin"],
  follow_up_due:        ["owner", "admin"],
  draft_ready:          ["owner", "admin", "member"],
  order_status_changed: ["owner", "admin", "member"],
  payment_due:          ["owner", "admin"],
  ki_search_done:       ["owner"],
  sync_failed:          ["owner", "admin"],
  invoice_not_sent:     ["owner", "admin"],
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405 });
  }

  const { venture, event_type, title, body, link } = await req.json();
  if (!venture || !event_type || !title) {
    return new Response(JSON.stringify({ error: "venture, event_type, title required" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Alle User mit Zugang zu diesem Venture holen (nach erlaubten Rollen filtern)
  const allowedRoles = ROLE_MAP[event_type] ?? ["owner", "admin"];
  const { data: ventureUsers, error: uvError } = await supabase
    .from("user_venture_roles")
    .select("user_id, role")
    .eq("venture", venture)
    .in("role", allowedRoles);

  if (uvError) {
    console.error("user_venture_roles Fehler:", uvError.message);
    return new Response(JSON.stringify({ error: uvError.message }), { status: 500 });
  }

  if (!ventureUsers || ventureUsers.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "Keine User für dieses Venture" }), { status: 200 });
  }

  let sent = 0;

  for (const { user_id } of ventureUsers) {
    // Präferenz prüfen (Default: in_app=true, email=false)
    const { data: pref } = await supabase
      .from("notification_preferences")
      .select("in_app, email")
      .eq("user_id", user_id)
      .eq("venture", venture)
      .eq("event_type", event_type)
      .maybeSingle();

    const inApp = pref ? pref.in_app : true;

    if (!inApp) continue;

    const { error: insertError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        venture,
        event_type,
        title,
        body:       body ?? null,
        link:       link ?? null,
        read:       false,
        email_sent: false,
      });

    if (insertError) {
      console.error(`Notification für ${user_id} fehlgeschlagen:`, insertError.message);
    } else {
      sent++;
    }
  }

  console.log(`send-notification: ${event_type} @ ${venture} → ${sent} User benachrichtigt`);
  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
