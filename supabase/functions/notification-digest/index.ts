/**
 * notification-digest
 * Läuft täglich 08:00 UTC via pg_cron.
 * Sammelt alle ungesendeten E-Mail-Notifications der letzten 24h,
 * gruppiert sie pro User und versendet einen HTML-Digest via Resend.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY            = Deno.env.get("RESEND_API_KEY")!;

const EVENT_LABELS: Record<string, string> = {
  new_lead:             "Neuer Lead",
  follow_up_due:        "Follow-up fällig",
  draft_ready:          "KI-Draft bereit",
  order_status_changed: "Auftragsstatus",
  payment_due:          "Zahlung fällig",
  ki_search_done:       "KI-Suche",
  sync_failed:          "Sync-Fehler",
  invoice_not_sent:     "Rechnung",
};

const EVENT_ICONS: Record<string, string> = {
  new_lead:             "👤",
  follow_up_due:        "⏰",
  draft_ready:          "✉️",
  order_status_changed: "📋",
  payment_due:          "💳",
  ki_search_done:       "🤖",
  sync_failed:          "⚠️",
  invoice_not_sent:     "📄",
};

async function sendDigestMail(
  to: string,
  userName: string,
  notifications: { title: string; body: string | null; event_type: string; venture: string; created_at: string }[]
): Promise<boolean> {
  // Gruppieren nach Venture
  const byVenture: Record<string, typeof notifications> = {};
  for (const n of notifications) {
    if (!byVenture[n.venture]) byVenture[n.venture] = [];
    byVenture[n.venture].push(n);
  }

  const ventureBlocks = Object.entries(byVenture).map(([venture, items]) => `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                  color:#C8A96E;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #E5E7EB;">
        ${venture.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
      </div>
      ${items.map(n => `
        <div style="padding:10px 0;border-bottom:1px solid #F3F4F6;display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:18px;line-height:1;">${EVENT_ICONS[n.event_type] ?? "🔔"}</span>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:#14193A;">${n.title}</div>
            ${n.body ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${n.body}</div>` : ""}
            <div style="font-size:11px;color:#9CA3AF;margin-top:3px;">
              ${EVENT_LABELS[n.event_type] ?? n.event_type} ·
              ${new Date(n.created_at).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F8FC;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;
              border:1px solid #E5E7EB;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background:#14193A;padding:24px 28px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.15em;color:#C8A96E;">FOUNDER OS</div>
      <div style="font-size:20px;font-weight:300;color:#FFFFFF;margin-top:4px;">Dein täglicher Überblick</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">
        ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="font-size:14px;color:#6B7280;margin:0 0 20px;">
        Hallo ${userName}, hier sind deine Ereignisse der letzten 24 Stunden:
      </p>
      ${ventureBlocks}
      <div style="margin-top:24px;text-align:center;">
        <a href="${SUPABASE_URL.replace("/rest/v1", "").replace("supabase.co", "vercel.app")}/benachrichtigungen"
           style="display:inline-block;background:#14193A;color:#FFFFFF;text-decoration:none;
                  padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;">
          Alle Benachrichtigungen öffnen →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F7F8FC;padding:16px 28px;border-top:1px solid #E5E7EB;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;text-align:center;">
        Du erhältst diese E-Mail weil du E-Mail-Benachrichtigungen für dieses Venture aktiviert hast.<br>
        Einstellungen ändern: Founder OS → Einstellungen → Benachrichtigungen
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "Founder OS <notify@onlinefirst.eu>",
      to:      [to],
      subject: `Founder OS Digest — ${notifications.length} Ereignis${notifications.length !== 1 ? "se" : ""} heute`,
      html,
    }),
  });

  return res.ok;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const since    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Alle ungesendeten E-Mail-Notifications der letzten 24h laden
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, user_id, venture, event_type, title, body, created_at")
    .eq("email_sent", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Notifications laden fehlgeschlagen:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!notifications || notifications.length === 0) {
    console.log("Keine ungesendeten Notifications — kein Digest nötig");
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  // Pro User prüfen ob E-Mail für diesen Event aktiviert ist
  const userIds = [...new Set(notifications.map((n) => n.user_id))];
  let totalSent = 0;

  for (const userId of userIds) {
    const userNotifs = notifications.filter((n) => n.user_id === userId);

    // E-Mail-Präferenzen für diesen User
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("venture, event_type, email")
      .eq("user_id", userId);

    const prefMap = new Map(
      (prefs ?? []).map((p: any) => [`${p.venture}:${p.event_type}`, p.email])
    );

    // Nur Notifications wo email=true (Default: false)
    const toSend = userNotifs.filter((n) => {
      const key = `${n.venture}:${n.event_type}`;
      return prefMap.get(key) === true;
    });

    if (toSend.length === 0) continue;

    // User-E-Mail aus auth.users holen
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email    = userData?.user?.email;
    const userName = userData?.user?.user_metadata?.name ?? userData?.user?.email?.split("@")[0] ?? "Founder";

    if (!email) continue;

    const sent = await sendDigestMail(email, userName, toSend);

    if (sent) {
      // Als email_sent markieren
      const ids = toSend.map((n) => n.id);
      await supabase.from("notifications").update({ email_sent: true }).in("id", ids);
      totalSent++;
      console.log(`Digest an ${email} gesendet (${toSend.length} Events)`);
    } else {
      console.error(`Digest an ${email} fehlgeschlagen`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, users_notified: totalSent }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
