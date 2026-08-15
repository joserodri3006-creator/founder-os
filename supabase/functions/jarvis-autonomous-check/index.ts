import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Taeglicher, unbeaufsichtigter Cron-Lauf: Jarvis prueft pro Venture, ob faellige
// Follow-ups anstehen, und schlaegt Standard-Follow-up-Mails vor. SOP-konforme Faelle
// werden im "live"-Modus automatisch versendet, alles andere landet als "pending" in
// der Inbox (/jarvis/aktionen) zur Bestaetigung durch den Founder.
//
// Sicherheitsnetz: standardmaessig komplett AUS (system_config 'jarvis_autonomy_enabled'
// muss explizit auf 'true' gesetzt werden), und pro Venture defaultet der Modus auf
// 'shadow' (nur vorschlagen, nie automatisch ausfuehren) bis 'jarvis_autonomy_mode_<venture>'
// explizit auf 'live' gesetzt wird.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Nur die im DB-Enum bestaetigten Ventures (worknest/itaba fehlen dort noch, siehe CLAUDE.md).
const VENTURES = ["online_first", "blazed_outfitters", "droplane", "brandary"] as const;

const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first: { name: "Jose | Online First", email: "info@onlinefirst.eu" },
  brandary: { name: "Brandary Print Studio", email: "info@brandary.de" },
  droplane: { name: "Droplane", email: "info@droplane.de" },
  blazed_outfitters: { name: "Blazed Outfitters", email: "info@blazedoutfitters.com" },
};

const MAX_LEADS_PER_VENTURE = 15;
const MAX_ACTIONS_PER_RUN = 20;

interface LeadCandidate {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string;
  status: string;
  follow_up_date: string | null;
}

interface FollowUpProposal {
  lead_id: string;
  subject: string;
  body: string;
  reason: string;
}

async function getConfig(key: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("system_config").select("value").eq("key", key).single();
  return data?.value ?? fallback;
}

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function proposeFollowUps(venture: string, leads: LeadCandidate[]): Promise<FollowUpProposal[]> {
  const system = `Du bist Jarvis, der KI-Assistent im Founder OS. Du bekommst eine Liste von Leads der
Venture "${venture}", deren Follow-up-Termin faellig ist. Formuliere fuer JEDEN Lead eine kurze,
freundliche Standard-Follow-up-E-Mail auf Deutsch (KEINE Rabatte, KEINE Sonderkonditionen).
Antworte AUSSCHLIESSLICH mit einem JSON-Array, ein Element pro Lead:
{"lead_id": "...", "subject": "...", "body": "...", "reason": "kurze Begruendung warum jetzt Follow-up sinnvoll ist"}
Kein Fließtext, kein Markdown, nur das rohe JSON-Array.`;

  const userPrompt = JSON.stringify(
    leads.map((l) => ({
      lead_id: l.id,
      name: `${l.first_name} ${l.last_name}`.trim(),
      company: l.company_name,
      status: l.status,
      follow_up_date: l.follow_up_date,
    }))
  );

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API Fehler (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.find((b: { type: string; text?: string }) => b.type === "text")?.text ?? "";
  return extractJsonArray(text) as FollowUpProposal[];
}

async function sendFollowUpEmail(venture: string, lead: LeadCandidate, proposal: FollowUpProposal) {
  const sender = VENTURE_SENDERS[venture] ?? VENTURE_SENDERS.online_first;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${sender.name} <${sender.email}>`,
      to: [`${lead.first_name} ${lead.last_name}`.trim() ? `${lead.first_name} ${lead.last_name} <${lead.email}>` : lead.email],
      subject: proposal.subject,
      text: proposal.body,
    }),
  });
  if (!res.ok) throw new Error(`Resend Fehler (${res.status}): ${await res.text()}`);

  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "email_sent",
    description: `Betreff: ${proposal.subject} (Jarvis, autonom)`,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const enabled = await getConfig("jarvis_autonomy_enabled", "false");
  if (enabled !== "true") {
    return new Response(JSON.stringify({ skipped: true, reason: "jarvis_autonomy_enabled ist nicht 'true'" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const stats: Record<string, { proposed: number; executed: number; skipped_existing: number; errors: number }> = {};
  let totalActions = 0;

  for (const venture of VENTURES) {
    stats[venture] = { proposed: 0, executed: 0, skipped_existing: 0, errors: 0 };
    if (totalActions >= MAX_ACTIONS_PER_RUN) break;

    try {
      const mode = await getConfig(`jarvis_autonomy_mode_${venture}`, "shadow");

      const { data: dueLeads, error: leadsError } = await supabase
        .from("leads")
        .select("id, first_name, last_name, company_name, email, status, follow_up_date")
        .eq("venture", venture)
        .lte("follow_up_date", today)
        .not("status", "in", '("gewonnen","verloren")')
        .not("email", "is", null)
        .is("archived_at", null)
        .limit(MAX_LEADS_PER_VENTURE)
        .returns<LeadCandidate[]>();

      if (leadsError) throw leadsError;
      if (!dueLeads || dueLeads.length === 0) continue;

      // Bereits heute vorgeschlagene/ausgefuehrte Leads nicht erneut vorschlagen.
      const { data: alreadyHandled } = await supabase
        .from("jarvis_autonomous_actions")
        .select("entity_id")
        .eq("venture", venture)
        .eq("action_type", "send_followup_email")
        .in("status", ["pending", "approved", "executed"])
        .gte("created_at", `${today}T00:00:00.000Z`);
      const handledIds = new Set((alreadyHandled ?? []).map((r: { entity_id: string }) => r.entity_id));

      const candidates = dueLeads.filter((l) => !handledIds.has(l.id));
      stats[venture].skipped_existing = dueLeads.length - candidates.length;
      if (candidates.length === 0) continue;

      const { data: sop } = await supabase
        .from("sop_definitions")
        .select("id")
        .eq("venture", venture)
        .eq("action_type", "send_followup_email")
        .eq("active", true)
        .maybeSingle();

      const proposals = await proposeFollowUps(venture, candidates);

      for (const proposal of proposals) {
        if (totalActions >= MAX_ACTIONS_PER_RUN) break;
        const lead = candidates.find((l) => l.id === proposal.lead_id);
        if (!lead || !proposal.subject || !proposal.body) continue;

        stats[venture].proposed++;
        totalActions++;

        const sopConform = Boolean(sop?.id);
        const shouldAutoExecute = sopConform && mode === "live";

        if (shouldAutoExecute) {
          try {
            await sendFollowUpEmail(venture, lead, proposal);
            await supabase.from("jarvis_autonomous_actions").insert({
              venture,
              action_type: "send_followup_email",
              entity_type: "lead",
              entity_id: lead.id,
              action_payload: { subject: proposal.subject, body: proposal.body },
              reason: proposal.reason || "Fälliger Standard-Follow-up",
              sop_id: sop?.id ?? null,
              status: "executed",
              result: { sent: true },
              resolved_at: new Date().toISOString(),
            });
            stats[venture].executed++;
          } catch (sendErr) {
            await supabase.from("jarvis_autonomous_actions").insert({
              venture,
              action_type: "send_followup_email",
              entity_type: "lead",
              entity_id: lead.id,
              action_payload: { subject: proposal.subject, body: proposal.body },
              reason: proposal.reason || "Fälliger Standard-Follow-up",
              sop_id: sop?.id ?? null,
              status: "failed",
              result: { error: String(sendErr) },
              resolved_at: new Date().toISOString(),
            });
            stats[venture].errors++;
          }
        } else {
          await supabase.from("jarvis_autonomous_actions").insert({
            venture,
            action_type: "send_followup_email",
            entity_type: "lead",
            entity_id: lead.id,
            action_payload: { subject: proposal.subject, body: proposal.body },
            reason: proposal.reason || "Fälliger Standard-Follow-up",
            sop_id: sop?.id ?? null,
            status: "pending",
          });
        }
      }
    } catch (err) {
      console.error(`Jarvis Autonomie-Check fehlgeschlagen fuer ${venture}:`, err);
      stats[venture].errors++;
    }
  }

  return new Response(JSON.stringify({ success: true, date: today, stats }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
