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
  absender: string;       // Wer schreibt
  leistung: string;       // Was wir konkret machen
  typischePainPoints: string;  // Branchenspezifische Probleme die wir lösen
  beispiele: string;      // Konkrete Beispiele/Ergebnisse
  cta: string;            // Gewünschte nächste Aktion
}

const VENTURE_CONTEXTS: Record<string, VentureContext> = {
  online_first: {
    name: "Online First",
    absender: "Jose Rodriguez, Gründer von Online First (Webdesign-Agentur, Hessen)",
    leistung: "professionelle Websites, Landingpages und Onlineshops — fertig in 2–4 Wochen, kein Abo, einmaliger Festpreis",
    typischePainPoints: `- Veraltete Website die auf Mobilgeräten nicht funktioniert
- Keine Sichtbarkeit bei Google (kaum Anfragen über die Website)
- Website wird intern gepflegt aber sieht unprofessionell aus
- Kein Onlineshop obwohl der Umsatz davon profitieren würde
- Konkurrenz hat modernere Auftritte und zieht Kunden ab`,
    beispiele: "Handwerksbetriebe, Dienstleister, Fachbetriebe, lokale Unternehmen — typisch: 30–50% mehr Anfragen nach Relaunch",
    cta: "Kurzes 15-Minuten-Gespräch um zu schauen ob und wie wir helfen können",
  },
  brandary: {
    name: "Brandary Print Studio",
    absender: "Frederick Feldmann, Brandary Print Studio Frankfurt",
    leistung: "Textilveredlung, DTF-Druck, Stickerei, Workwear-Branding — kleine Mengen ab 1 Stück, schnelle Lieferung",
    typischePainPoints: `- Hohe Mindestmengen bei anderen Anbietern
- Lange Lieferzeiten (4–6 Wochen) die Projekte verzögern
- Schlechte Druckqualität die nach wenigen Wäschen verblasst
- Kein persönlicher Ansprechpartner — nur anonyme Onlinebestellungen
- Teurer Zwischenhändler der den Preis hochtreibt`,
    beispiele: "Vereins-Hoodies, Firmen-Workwear, Event-Merchandise, Gastro-Uniformen — direkt vom Studio, kein Zwischenhändler",
    cta: "Kurze Anfrage mit Motiv und Menge — wir machen ein Angebot innerhalb von 24h",
  },
  droplane: {
    name: "Droplane",
    absender: "Jose Rodriguez, Gründer von Droplane",
    leistung: "Creator-Plattform: Portfolio, Buchungssystem und Community für Fotografen, Videografen und Content Creator",
    typischePainPoints: `- Anfragen kommen über Instagram DM — chaotisch, kein System
- Kein professionelles Portfolio das Kunden überzeugt
- Preise werden jedes Mal neu verhandelt statt klar kommuniziert
- Kein Buchungsprozess — Kunden canceln spontan
- Kein Weg die eigene Community zu monetarisieren`,
    beispiele: "Creator mit 5k–200k Followern die endlich einen professionellen Auftritt wollen der Anfragen automatisch qualifiziert",
    cta: "Kurze Demo — ich zeige dir wie das für deinen Case konkret aussehen würde",
  },
  blazed_outfitters: {
    name: "Blazed Outfitters",
    absender: "Jose Rodriguez, Gründer von Blazed Outfitters",
    leistung: "limitierte Streetwear-Drops mit Cannabis-Ästhetik — Kooperationen mit Stores, Boutiquen und Resellern",
    typischePainPoints: `- Sortiment braucht frische, authentische Streetwear-Labels
- Kunden fragen nach Lifestyle-Brands mit echtem Hintergrund
- Keine Limited-Edition Pieces die Traffic in den Store bringen
- Fehlende Kooperationen mit aufstrebenden Marken`,
    beispiele: "Limitierte Kollektionen, Konsignationsmodell möglich, keine Mindestabnahme für erste Kooperation",
    cta: "Produktfotos und Preisliste schicken — oder kurzes Gespräch wenn du neugierig bist",
  },
  itaba: {
    name: "Itaba",
    absender: "Jose Rodriguez, Itaba",
    leistung: "handgefertigte Wohnaccessoires und Naturmaterialien — für Innenarchitekten, Interior-Stores und B2B-Einkäufer",
    typischePainPoints: `- Massengefertigte Produkte ohne Charakter und Differenzierung
- Lieferanten die keine kleinen Mengen für Testorders anbieten
- Kein direkter Kontakt zum Hersteller — nur Zwischenhändler
- Kunden wollen nachhaltige, authentische Produkte — Sortiment hält nicht mit`,
    beispiele: "Tische, Leuchten, Küchenaccessoires aus Naturmaterialien — Kleinserien, individuelle B2B-Konditionen möglich",
    cta: "Produktkatalog und B2B-Konditionen — einfach kurz antworten",
  },
};

async function generateDraft(lead: Lead, type: "erstkonakt" | "follow_up"): Promise<{ subject: string; body: string }> {
  const ctx = VENTURE_CONTEXTS[lead.venture] ?? VENTURE_CONTEXTS.online_first;

  const isFollowUp = type === "follow_up";

  const system = `Du bist ${ctx.absender}.
Du schreibst eine ${isFollowUp ? "Follow-Up-Mail" : "Erstkontakt-Mail"} — auf Deutsch, direkt, konkret.

WICHTIG — Diese Regeln sind nicht verhandelbar:
1. KEIN generischer Einstieg. Nie "Ich hoffe diese E-Mail findet Sie gut", nie "Mein Name ist X und ich bin...".
2. Steig sofort mit einem konkreten Bezug zum Unternehmen oder zur Branche ein.
3. Nenne EIN konkretes Problem das dieser Lead wahrscheinlich kennt — passend zu seiner Branche und Situation.
4. Erkläre in 1–2 Sätzen wie du das löst. Konkret, nicht abstrakt.
5. Ein klarer CTA am Ende — keine offene Floskel.
6. Länge: maximal 120 Wörter im Body. Kürzer ist besser.
7. Kein "Mit freundlichen Grüßen" — schreib einfach den Vornamen als Abschluss.
8. Subject-Line: spezifisch, kein Clickbait, max. 8 Wörter.
${isFollowUp ? "9. Follow-Up: Beziehe dich darauf, dass du bereits geschrieben hast. Kein Vorwurf, aber direkt." : ""}

Was wir anbieten: ${ctx.leistung}
Typische Probleme die wir lösen:
${ctx.typischePainPoints}
Typische Kunden/Ergebnisse: ${ctx.beispiele}
Gewünschte nächste Aktion: ${ctx.cta}

Antworte NUR mit einem JSON-Objekt ohne Markdown-Blöcke:
{"subject": "...", "body": "..."}`;

  const leadInfo = `
Lead-Daten:
- Name: ${lead.first_name} ${lead.last_name}
- Unternehmen: ${lead.company_name ?? "—"}
- Branche: ${lead.industry ?? "—"}
- Stadt: ${lead.city ?? "—"}
- Kontaktgrund / Notiz: ${lead.contact_reason ?? lead.notes ?? "Keine spezifischen Infos vorhanden"}
- Quelle: ${lead.source}

Schreibe die Mail direkt an ${lead.first_name}. Nutze die verfügbaren Infos um einen KONKRETEN Bezug herzustellen.
Wenn Branche oder Unternehmen bekannt sind: Nenne ein branchenspezifisches Problem.
Wenn wenig Info vorhanden: Nutze ein universell relevantes Problem aus der Zielgruppe.`;

  // Sonnet für Drafts — Qualität ist hier entscheidend
  const raw = await callClaude(leadInfo, system, "claude-sonnet-4-6");
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
          const { data: existingOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("lead_id", lead.id)
            .maybeSingle();

          if (!existingOrder) {
            const { error: orderError } = await supabase.from("orders").insert({
              venture: lead.venture,
              customer_id: customerId,
              lead_id: lead.id,
              title: `Webdesign-Projekt — ${lead.company_name ?? `${lead.first_name} ${lead.last_name}`}`,
              status: "neu",
            });
            if (orderError) console.error("Order-Anlage fehlgeschlagen:", orderError);
          }
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
