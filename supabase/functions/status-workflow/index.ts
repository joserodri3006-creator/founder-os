import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

interface Lead {
  id: string;
  venture: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
  contact_reason: string | null;
  notes: string | null;
  status: string;
  source: string;
  automation_enabled: boolean;
  ai_draft_body: string | null;
  ai_draft_subject: string | null;
  follow_up_date: string | null;
  reactivation_date: string | null;
  customer_id: string | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Lead;
  old_record: Lead;
}

async function callClaude(prompt: string, system: string, model = "claude-haiku-4-5-20251001"): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data.content[0].text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

interface VentureContext {
  name: string;
  senderIntro: string;
  targetGroup: string;
  defaultContactReason: string;
}

const VENTURE_CONTEXTS: Record<string, VentureContext> = {
  online_first: {
    name: "Online First",
    senderIntro: "Du bist Jose, Gründer von Online First — einer Webdesign-Agentur aus Hessen.",
    targetGroup: "Unternehmen ohne moderne Website oder Onlineshop",
    defaultContactReason: "Interesse an einer professionellen Website",
  },
  brandary: {
    name: "Brandary",
    senderIntro: "Du bist Jose, Gründer von Brandary — einem Print Studio für hochwertige Druckprodukte (Visitenkarten, Flyer, Merchandise).",
    targetGroup: "Unternehmen und Vereine die Druckprodukte benötigen",
    defaultContactReason: "Interesse an Druckprodukten",
  },
  droplane: {
    name: "Droplane",
    senderIntro: "Du bist Jose, Gründer von Droplane — einer Creator-Plattform für Content Creator, Fotografen und Videografen.",
    targetGroup: "Content Creator, Fotografen, Videografen und Influencer",
    defaultContactReason: "Interesse an der Droplane Creator-Plattform",
  },
  blazed_outfitters: {
    name: "Blazed Outfitters",
    senderIntro: "Du bist Jose, Gründer von Blazed Outfitters — einer Streetwear-Marke.",
    targetGroup: "Boutiquen, Concept Stores und Fashion-Influencer als Kooperationspartner",
    defaultContactReason: "Interesse an einer Kooperation mit Blazed Outfitters",
  },
};

async function generateDraft(lead: Lead, type: "erstkonakt" | "follow_up"): Promise<{ subject: string; body: string }> {
  const ctx = VENTURE_CONTEXTS[lead.venture] ?? VENTURE_CONTEXTS.online_first;

  const system = `${ctx.senderIntro}
Schreibe eine ${type === "erstkonakt" ? "Erstkontakt-Mail" : "Follow-Up-Mail"} an einen potenziellen ${ctx.targetGroup}.
Stil: professionell, persönlich, auf Augenhöhe. Kein Verkaufsdruck. Auf Deutsch.
Antworte NUR mit einem JSON-Objekt ohne Markdown: {"subject": "...", "body": "..."}`;

  const prompt = `Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Unternehmen: ${lead.company_name ?? "unbekannt"}
- Branche: ${lead.industry ?? "unbekannt"}
- Kontaktgrund: ${lead.contact_reason ?? ctx.defaultContactReason}
- Stadt: ${lead.city ?? "unbekannt"}
- Venture: ${ctx.name}
${type === "follow_up" ? "- Kontext: Diese Person wurde bereits kontaktiert aber hat noch nicht geantwortet." : ""}`;

  const raw = await callClaude(prompt, system);
  return JSON.parse(raw);
}

async function getConfig(supabase: ReturnType<typeof createClient>, key: string, fallback: string): Promise<string> {
  const { data } = await supabase.from("system_config").select("value").eq("key", key).single();
  return data?.value ?? fallback;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { type, table, record: lead, old_record } = payload;

  // Nur leads UPDATE Events verarbeiten
  if (type !== "UPDATE" || table !== "leads") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  // Nur bei tatsächlichem Status-Wechsel
  if (old_record?.status === lead.status) {
    return new Response(JSON.stringify({ skipped: "no status change" }), { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const newStatus = lead.status;
  const update: Record<string, unknown> = {};

  console.log(`Status-Wechsel: ${old_record.status} → ${newStatus} (Lead: ${lead.id})`);

  try {
    switch (newStatus) {

      case "in_bearbeitung": {
        if (!lead.automation_enabled) break;
        if (lead.ai_draft_body) break; // Draft existiert bereits

        const draft = await generateDraft(lead, "erstkonakt");
        update.ai_draft_subject = draft.subject;
        update.ai_draft_body = draft.body;
        update.ai_draft_created_at = new Date().toISOString();
        update.ai_draft_approved = false;
        break;
      }

      case "kontaktiert": {
        if (!lead.automation_enabled) break;
        const followUpDays = parseInt(await getConfig(supabase, "follow_up_delay_days", "3"));
        update.follow_up_date = addDays(followUpDays);
        update.last_contacted_at = new Date().toISOString();
        break;
      }

      case "follow_up": {
        if (!lead.automation_enabled) break;
        const today = new Date().toISOString().split("T")[0];
        if (lead.follow_up_date && lead.follow_up_date > today) break; // Noch nicht fällig

        const draft = await generateDraft(lead, "follow_up");
        update.ai_draft_subject = draft.subject;
        update.ai_draft_body = draft.body;
        update.ai_draft_created_at = new Date().toISOString();
        update.ai_draft_approved = false;
        break;
      }

      case "gewonnen": {
        update.won_at = new Date().toISOString();

        // Customer anlegen falls nicht vorhanden
        let customerId = lead.customer_id;
        if (!customerId) {
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .insert({
              venture: lead.venture,
              first_name: lead.first_name,
              last_name: lead.last_name,
              email: lead.email,
              phone: lead.phone,
              company_name: lead.company_name,
              website: lead.website,
              city: lead.city,
              region: lead.region ?? "Hessen",
            })
            .select("id")
            .single();

          if (customerError) {
            console.error("Customer-Anlage fehlgeschlagen:", customerError);
          } else {
            customerId = customer.id;
            update.customer_id = customerId;
          }
        }

        // Order anlegen
        if (customerId) {
          const { error: orderError } = await supabase.from("orders").insert({
            venture: lead.venture,
            customer_id: customerId,
            lead_id: lead.id,
            title: `Webdesign-Projekt — ${lead.company_name ?? `${lead.first_name} ${lead.last_name}`}`,
            status: "neu",
          });
          if (orderError) console.error("Order-Anlage fehlgeschlagen:", orderError);
        }
        break;
      }

      case "verloren": {
        update.lost_at = new Date().toISOString();
        break;
      }

      case "nachfassen_zukunft": {
        if (!lead.reactivation_date) {
          update.reactivation_date = addDays(30);
        }
        break;
      }
    }

    // Update ausführen falls Änderungen vorhanden
    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from("leads").update(update).eq("id", lead.id);
      if (error) {
        console.error("Lead-Update fehlgeschlagen:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // Notification: KI-Draft bereit
    if (update.ai_draft_subject) {
      fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          venture:    lead.venture,
          event_type: "draft_ready",
          title:      `KI-Draft bereit: ${lead.first_name} ${lead.last_name}`,
          body:       update.ai_draft_subject,
          link:       `/drafts`,
        }),
      }).catch((e) => console.error("send-notification fehlgeschlagen:", e));
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus, updated_fields: Object.keys(update) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unerwarteter Fehler:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
