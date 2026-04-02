import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const RECIPIENT = "info@onlinefirst.eu";
const SENDER = "Founder OS <noreply@onlinefirst.eu>";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string;
  source: string;
  follow_up_date: string | null;
  status: string;
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: RECIPIENT,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API Fehler (${res.status}): ${err}`);
  }
}

Deno.serve(async (req) => {
  // Cron-Job sendet GET; manuelle Trigger per POST erlauben
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Neue Leads von heute abrufen
  const { data: newLeads, error: leadsError } = await supabase
    .from("leads")
    .select("id, first_name, last_name, company_name, email, source, follow_up_date, status")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lt("created_at", `${today}T23:59:59.999Z`)
    .is("archived_at", null)
    .returns<Lead[]>();

  if (leadsError) {
    console.error("Fehler beim Abrufen neuer Leads:", leadsError);
    return new Response(JSON.stringify({ error: leadsError.message }), { status: 500 });
  }

  const leads = newLeads ?? [];

  // Nach Source gruppieren
  const bySource: Record<string, number> = {};
  for (const lead of leads) {
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;
  }

  // Fällige Follow-Ups abrufen (follow_up_date <= heute)
  const { data: followUps, error: followUpError } = await supabase
    .from("leads")
    .select("id, first_name, last_name, company_name, email, follow_up_date, status")
    .lte("follow_up_date", today)
    .not("status", "in", '("gewonnen","verloren")')
    .is("archived_at", null)
    .returns<Lead[]>();

  if (followUpError) {
    console.error("Fehler beim Abrufen der Follow-Ups:", followUpError);
    return new Response(JSON.stringify({ error: followUpError.message }), { status: 500 });
  }

  const dueFollowUps = followUps ?? [];

  // Datum für Betreff
  const dateLabel = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Neue Leads HTML-Block
  const sourceLines = Object.entries(bySource)
    .map(([src, cnt]) => `<li>${src}: <strong>${cnt}</strong></li>`)
    .join("");

  const newLeadsHtml =
    leads.length === 0
      ? "<p>Keine neuen Leads heute.</p>"
      : `<p>Heute: <strong>${leads.length}</strong> neue Lead${leads.length !== 1 ? "s" : ""}.</p>
         <ul>${sourceLines}</ul>
         <table style="border-collapse:collapse;width:100%;font-size:14px">
           <thead>
             <tr style="background:#f3f4f6;text-align:left">
               <th style="padding:8px 12px">Name</th>
               <th style="padding:8px 12px">Unternehmen</th>
               <th style="padding:8px 12px">E-Mail</th>
               <th style="padding:8px 12px">Quelle</th>
             </tr>
           </thead>
           <tbody>
             ${leads
               .map(
                 (l) =>
                   `<tr style="border-top:1px solid #e5e7eb">
                     <td style="padding:8px 12px">${l.first_name} ${l.last_name}</td>
                     <td style="padding:8px 12px">${l.company_name ?? "—"}</td>
                     <td style="padding:8px 12px">${l.email}</td>
                     <td style="padding:8px 12px">${l.source}</td>
                   </tr>`
               )
               .join("")}
           </tbody>
         </table>`;

  // Follow-Up HTML-Block
  const followUpHtml =
    dueFollowUps.length === 0
      ? "<p>Keine fälligen Follow-Ups.</p>"
      : `<p><strong>${dueFollowUps.length}</strong> fällige${dueFollowUps.length !== 1 ? " Follow-Ups" : "r Follow-Up"}:</p>
         <table style="border-collapse:collapse;width:100%;font-size:14px">
           <thead>
             <tr style="background:#f3f4f6;text-align:left">
               <th style="padding:8px 12px">Name</th>
               <th style="padding:8px 12px">Unternehmen</th>
               <th style="padding:8px 12px">E-Mail</th>
               <th style="padding:8px 12px">Follow-Up</th>
               <th style="padding:8px 12px">Status</th>
             </tr>
           </thead>
           <tbody>
             ${dueFollowUps
               .map(
                 (l) =>
                   `<tr style="border-top:1px solid #e5e7eb">
                     <td style="padding:8px 12px">${l.first_name} ${l.last_name}</td>
                     <td style="padding:8px 12px">${l.company_name ?? "—"}</td>
                     <td style="padding:8px 12px">${l.email}</td>
                     <td style="padding:8px 12px">${l.follow_up_date ?? "—"}</td>
                     <td style="padding:8px 12px">${l.status}</td>
                   </tr>`
               )
               .join("")}
           </tbody>
         </table>`;

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto;color:#111">
      <h2 style="font-size:18px;margin-bottom:4px">Lead Summary — ${dateLabel}</h2>
      <p style="color:#6b7280;font-size:13px;margin-top:0">Automatisch generiert von Founder OS</p>

      <h3 style="font-size:15px;margin-top:28px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">
        Neue Leads heute
      </h3>
      ${newLeadsHtml}

      <h3 style="font-size:15px;margin-top:28px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">
        Fällige Follow-Ups
      </h3>
      ${followUpHtml}

      <p style="font-size:12px;color:#9ca3af;margin-top:32px">
        Founder OS · ${dateLabel}
      </p>
    </div>
  `;

  try {
    await sendEmail(`Lead Summary — ${dateLabel}`, html);
  } catch (err) {
    console.error("E-Mail-Versand fehlgeschlagen:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }

  console.log(
    `Daily Summary gesendet: ${leads.length} neue Leads, ${dueFollowUps.length} Follow-Ups`
  );

  return new Response(
    JSON.stringify({
      success: true,
      date: today,
      new_leads: leads.length,
      due_follow_ups: dueFollowUps.length,
      by_source: bySource,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
