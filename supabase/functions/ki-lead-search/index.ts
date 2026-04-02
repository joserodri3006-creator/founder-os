import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

interface VentureConfig {
  venture: string;
  enabled: boolean;
  limit: number;
  region: string;
  focus: string;         // Beschreibung für Claude, was gesucht wird
  industry_hint: string; // Branchen-Fokus
  note_hint: string;     // Was in die notes soll
}

interface KiLead {
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  city: string;
  industry: string;
  notes: string;
}

interface VentureResult {
  venture: string;
  saved: number;
  duplicates: number;
  errors: number;
}

async function getConfig(
  supabase: ReturnType<typeof createClient>,
  key: string,
  fallback: string
): Promise<string> {
  const { data } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? fallback;
}

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API Fehler (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

async function saveLead(
  supabase: ReturnType<typeof createClient>,
  lead: KiLead,
  venture: string
): Promise<{ saved?: true; id?: string; duplicate?: boolean; error?: string }> {
  // Duplikat-Check: gleiche E-Mail oder gleicher Firmenname im selben Venture
  let isDuplicate = false;

  if (lead.email && !lead.email.includes("placeholder.invalid")) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("email", lead.email.toLowerCase())
      .eq("venture", venture)
      .maybeSingle();
    if (existing) isDuplicate = true;
  }

  if (!isDuplicate && lead.company_name) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .ilike("company_name", lead.company_name.trim())
      .eq("venture", venture)
      .maybeSingle();
    if (existing) isDuplicate = true;
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      venture,
      first_name: lead.first_name?.trim() || "Unbekannt",
      last_name: lead.last_name?.trim() || "",
      company_name: lead.company_name?.trim() || null,
      email: lead.email?.toLowerCase().trim() || `ki-suche-${Date.now()}@placeholder.invalid`,
      city: lead.city?.trim() || null,
      industry: lead.industry?.trim() || null,
      notes: lead.notes?.trim() || null,
      source: "ki_suche",
      status: "neu",
      automation_enabled: false,
      is_duplicate: isDuplicate,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { saved: true, id: data.id, duplicate: isDuplicate };
}

async function searchForVenture(
  supabase: ReturnType<typeof createClient>,
  cfg: VentureConfig
): Promise<VentureResult> {
  console.log(`[${cfg.venture}] Suche ${cfg.limit} Leads in ${cfg.region}...`);

  const system = `Du bist ein Rechercheassistent. Deine Aufgabe: potenzielle Leads für ein Unternehmen finden.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Array. Kein erklärender Text, keine Markdown-Formatierung.`;

  const prompt = `Erstelle eine Liste von ${cfg.limit} fiktiven aber realistischen Leads aus ${cfg.region}.

Zielgruppe: ${cfg.focus}
Branchen-Fokus: ${cfg.industry_hint}

Antworte NUR als JSON Array:
[
  {
    "first_name": "Vorname",
    "last_name": "Nachname",
    "company_name": "Firmenname oder leer falls Privatperson",
    "email": "plausible E-Mail-Adresse",
    "city": "Stadt in ${cfg.region}",
    "industry": "Branche",
    "notes": "${cfg.note_hint}"
  }
]

Wichtig: Plausible, realistische E-Mail-Adressen (basierend auf Name/Firma). Keine Platzhalter.`;

  let leads: KiLead[];
  try {
    const raw = await callClaude(system, prompt);
    leads = JSON.parse(raw);
    if (!Array.isArray(leads)) throw new Error("Kein Array");
  } catch (err) {
    console.error(`[${cfg.venture}] Claude-Parsing fehlgeschlagen:`, err);
    return { venture: cfg.venture, saved: 0, duplicates: 0, errors: 1 };
  }

  let saved = 0, duplicates = 0, errors = 0;
  for (const lead of leads) {
    const result = await saveLead(supabase, lead, cfg.venture);
    if (result.saved) {
      saved++;
      if (result.duplicate) duplicates++;
    } else {
      errors++;
      console.error(`[${cfg.venture}] Speicherfehler:`, result.error);
    }
  }

  console.log(`[${cfg.venture}] Fertig: ${saved} gespeichert, ${duplicates} Duplikate, ${errors} Fehler`);
  return { venture: cfg.venture, saved, duplicates, errors };
}

// Standard-Konfiguration falls DB-Config fehlt
const DEFAULT_VENTURES: VentureConfig[] = [
  {
    venture: "online_first",
    enabled: true,
    limit: 10,
    region: "Hessen",
    focus: "Unternehmen die wahrscheinlich keine moderne Website oder keinen Onlineshop haben",
    industry_hint: "Einzelhandel, Handwerk, Gastronomie, Friseursalons, Reinigungen, lokale Dienstleister",
    note_hint: "Warum dieses Unternehmen eine professionelle Website braucht (1-2 Sätze)",
  },
  {
    venture: "brandary",
    enabled: false,
    limit: 5,
    region: "Hessen",
    focus: "Unternehmen und Vereine die regelmäßig Druckprodukte benötigen (Visitenkarten, Flyer, Aufkleber, Merchandise, Eventmaterial, Schilder)",
    industry_hint: "Gastronomiebetriebe, Eventveranstalter, Sportvereine, lokale Unternehmen, Handwerksbetriebe, NGOs",
    note_hint: "Welche Druckprodukte dieses Unternehmen/Verein braucht und warum (1-2 Sätze)",
  },
  {
    venture: "droplane",
    enabled: false,
    limit: 5,
    region: "Deutschland",
    focus: "Content Creator, Fotografen, Videografen, YouTuber, Podcaster, Social-Media-Influencer oder Freelance-Kreative die eine Creator-Plattform nutzen würden",
    industry_hint: "Fotografie, Videoproduktion, Social Media, Blogging, Podcasting, Gaming, Fitness & Lifestyle Creator",
    note_hint: "Was dieser Creator macht und warum er eine Creator-Plattform wie Droplane braucht (1-2 Sätze)",
  },
  {
    venture: "blazed_outfitters",
    enabled: false,
    limit: 5,
    region: "Deutschland",
    focus: "Potenzielle B2B-Partner oder Influencer für eine Streetwear/Fashion-Marke: Boutiquen, Concept Stores, Skateshops, Fashion-Blogger, Streetwear-Affine mit Reichweite",
    industry_hint: "Fashion Boutiquen, Streetwear, Skateboarding, Sportswear, Mode-Blogging, Urban Fashion, Concept Stores",
    note_hint: "Warum diese Person/dieses Unternehmen ein guter Partner für Blazed Outfitters wäre (1-2 Sätze)",
  },
];

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Globaler Kill-Switch
  const globalEnabled = await getConfig(supabase, "ki_search_enabled", "false");
  if (globalEnabled !== "true") {
    return new Response(
      JSON.stringify({ skipped: true, reason: "ki_search_enabled ist false" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Venture-Configs aus DB lesen (überschreibt Defaults falls vorhanden)
  const configRaw = await getConfig(supabase, "ki_search_ventures", "");
  let ventureConfigs: VentureConfig[] = DEFAULT_VENTURES;

  if (configRaw) {
    try {
      ventureConfigs = JSON.parse(configRaw);
    } catch {
      console.warn("ki_search_ventures konnte nicht geparst werden, nutze Defaults");
    }
  }

  const activeVentures = ventureConfigs.filter((v) => v.enabled);

  if (activeVentures.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Keine Ventures aktiviert" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`KI-Lead-Suche: ${activeVentures.length} aktive Venture(s)`);

  // Alle Ventures sequenziell durchlaufen (Claude-Rate-Limits vermeiden)
  const results: VentureResult[] = [];
  for (const cfg of activeVentures) {
    const result = await searchForVenture(supabase, cfg);
    results.push(result);
  }

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  const totalDuplicates = results.reduce((s, r) => s + r.duplicates, 0);

  return new Response(
    JSON.stringify({
      success: true,
      ventures_searched: activeVentures.length,
      total_saved: totalSaved,
      total_duplicates: totalDuplicates,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
