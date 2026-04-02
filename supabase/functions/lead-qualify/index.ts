import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Lead {
  id: string;
  venture: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
  website: string | null;
  city: string | null;
  industry: string | null;
  contact_reason: string | null;
  notes: string | null;
  source: string;
}

interface VentureContext {
  name: string;
  description: string;
  senderIntro: string;   // Wer schreibt die Mail
  targetGroup: string;   // Wer ist der Lead
  keyQuestion: string;   // Was ist das Hauptangebot
}

const VENTURE_CONTEXTS: Record<string, VentureContext> = {
  online_first: {
    name: "Online First",
    description: "Webdesign-Agentur aus Hessen — erstellt professionelle Websites und Onlineshops für lokale Unternehmen",
    senderIntro: "Du bist Jose, Gründer von Online First — einer Webdesign-Agentur aus Hessen.",
    targetGroup: "lokale Unternehmen ohne moderne Website oder Onlineshop",
    keyQuestion: "Wie kann Online First diesem Unternehmen helfen, online sichtbar zu werden?",
  },
  brandary: {
    name: "Brandary",
    description: "Print Studio — produziert hochwertige Druckprodukte: Visitenkarten, Flyer, Aufkleber, Merchandise, Eventmaterial",
    senderIntro: "Du bist Jose, Gründer von Brandary — einem Print Studio für hochwertige Druckprodukte.",
    targetGroup: "Unternehmen, Vereine und Eventveranstalter die professionelle Druckprodukte benötigen",
    keyQuestion: "Welche Druckprodukte könnte Brandary für dieses Unternehmen/diesen Verein herstellen?",
  },
  droplane: {
    name: "Droplane",
    description: "Creator-Plattform — Tools und Community für Content Creator, Fotografen, Videografen und Influencer",
    senderIntro: "Du bist Jose, Gründer von Droplane — einer Creator-Plattform für Content Creator.",
    targetGroup: "Content Creator, Fotografen, Videografen, YouTuber, Influencer und Freelance-Kreative",
    keyQuestion: "Wie kann Droplane diesem Creator helfen, seine Arbeit zu skalieren und zu monetarisieren?",
  },
  blazed_outfitters: {
    name: "Blazed Outfitters",
    description: "Streetwear-Marke — sucht Kooperationen mit Boutiquen, Concept Stores und Fashion-Influencern",
    senderIntro: "Du bist Jose, Gründer von Blazed Outfitters — einer aufstrebenden Streetwear-Marke.",
    targetGroup: "Boutiquen, Concept Stores, Skateshops und Fashion-Influencer als Kooperationspartner",
    keyQuestion: "Warum wäre eine Kooperation zwischen Blazed Outfitters und diesem Partner interessant?",
  },
};

const DEFAULT_CONTEXT = VENTURE_CONTEXTS.online_first;

async function callClaude(model: string, system: string, user: string): Promise<string> {
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
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API Fehler (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let lead_id: string;
  try {
    const body = await req.json();
    lead_id = body.lead_id;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!lead_id) {
    return new Response(JSON.stringify({ error: "lead_id fehlt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, venture, first_name, last_name, email, company_name, website, city, industry, contact_reason, notes, source")
    .eq("id", lead_id)
    .single<Lead>();

  if (fetchError || !lead) {
    return new Response(JSON.stringify({ error: "Lead nicht gefunden" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ctx = VENTURE_CONTEXTS[lead.venture] ?? DEFAULT_CONTEXT;

  // Schritt 1: Haiku klassifiziert den Lead
  const classifySystem = `Du bist ein Lead-Qualifizierungs-Assistent für ${ctx.name} (${ctx.description}).
Analysiere den Lead und antworte NUR mit einem gültigen JSON-Objekt, ohne Markdown oder Erklärungen.`;

  const classifyPrompt = `Lead-Daten:
- Name: ${lead.first_name} ${lead.last_name}
- Unternehmen: ${lead.company_name || "unbekannt"}
- Website: ${lead.website || "keine"}
- Stadt: ${lead.city || "unbekannt"}
- Branche: ${lead.industry || "unbekannt"}
- Kontaktgrund: ${lead.contact_reason || "nicht angegeben"}
- Notizen: ${lead.notes || "keine"}
- Quelle: ${lead.source}

Kernfrage für die Bewertung: ${ctx.keyQuestion}

Antworte mit diesem JSON:
{
  "quality_score": <1-5, wobei 5 = sehr vielversprechend für ${ctx.name}>,
  "industry_detected": "<erkannte Branche auf Deutsch>",
  "company_size_estimate": "<klein|mittel|groß>",
  "urgency": "<niedrig|mittel|hoch>",
  "key_need": "<das wichtigste Bedürfnis in einem Satz, bezogen auf ${ctx.name}>",
  "qualification_notes": "<kurze interne Notiz für den Founder, max 2 Sätze>"
}`;

  let classification: {
    quality_score: number;
    industry_detected: string;
    company_size_estimate: string;
    urgency: string;
    key_need: string;
    qualification_notes: string;
  };

  try {
    const raw = await callClaude("claude-haiku-4-5-20251001", classifySystem, classifyPrompt);
    classification = JSON.parse(raw);
  } catch (e) {
    console.error("Haiku Klassifizierung fehlgeschlagen:", e);
    return new Response(JSON.stringify({ error: "Klassifizierung fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Schritt 2: Sonnet schreibt personalisierten E-Mail-Draft
  const draftSystem = `${ctx.senderIntro}
Du schreibst die erste Kontaktmail an einen potenziellen ${ctx.targetGroup}.
Stil: professionell, persönlich, auf Augenhöhe. Kein Verkaufsdruck. Auf Deutsch.
Antworte NUR mit einem JSON-Objekt, ohne Markdown: {"subject": "...", "body": "..."}`;

  const draftPrompt = `Schreibe eine erste Kontaktmail für diesen Lead:

- Name: ${lead.first_name} ${lead.last_name}
- Unternehmen/Kontext: ${lead.company_name || ""}
- Branche: ${classification.industry_detected}
- Kontaktgrund: ${lead.contact_reason || `Interesse an ${ctx.name}`}
- Hauptbedürfnis: ${classification.key_need}
- Dringlichkeit: ${classification.urgency}
- Venture: ${ctx.name} (${ctx.description})`;

  let draft: { subject: string; body: string };

  try {
    const raw = await callClaude("claude-sonnet-4-6", draftSystem, draftPrompt);
    draft = JSON.parse(raw);
  } catch (e) {
    console.error("Sonnet Draft fehlgeschlagen:", e);
    return new Response(JSON.stringify({ error: "Draft-Generierung fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Lead aktualisieren
  const updateData: Record<string, unknown> = {
    ai_draft_subject: draft.subject,
    ai_draft_body: draft.body,
    ai_draft_created_at: new Date().toISOString(),
    ai_draft_approved: false,
  };

  if (!lead.industry && classification.industry_detected) {
    updateData.industry = classification.industry_detected;
  }

  const qualifyNote = `[KI-Analyse · ${ctx.name}] Score: ${classification.quality_score}/5 | ${classification.company_size_estimate} | Dringlichkeit: ${classification.urgency}\n${classification.qualification_notes}`;
  updateData.notes = lead.notes ? `${lead.notes}\n\n${qualifyNote}` : qualifyNote;

  const { error: updateError } = await supabase
    .from("leads")
    .update(updateData)
    .eq("id", lead_id);

  if (updateError) {
    console.error("Update fehlgeschlagen:", updateError);
    return new Response(JSON.stringify({ error: "Update fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, lead_id, venture: lead.venture, classification, draft: { subject: draft.subject } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
