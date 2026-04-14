import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

interface VentureConfig {
  venture: string;
  enabled: boolean;
  limit: number;
  region: string;
  focus: string;
  industry_hint: string;
  note_hint: string;
}

interface KiLead {
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  postal_code: string;
  street: string;
  industry: string;
  notes: string;       // Adresse + Quelle + Begründung
  source_url: string;  // URL wo der Lead gefunden wurde
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

/**
 * Extrahiert das erste vollständige JSON-Array aus einem Text,
 * auch wenn davor/danach erklärender Text steht.
 */
function extractJsonArray(text: string): string {
  // Markdown-Codeblöcke entfernen
  const stripped = text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Erstes '[' bis zum zugehörigen ']' finden
  const start = stripped.indexOf("[");
  if (start === -1) throw new Error("Kein JSON-Array im Text gefunden");

  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === "[") depth++;
    else if (stripped[i] === "]") {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  throw new Error("JSON-Array nicht vollständig (fehlende schließende Klammer)");
}

/** Einfacher Claude-Call ohne Tools — nur Text rein, Text raus. */
async function callClaude(system: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API Fehler (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.content.find((b: any) => b.type === "text")?.text ?? "";
}

/**
 * Zweistufig:
 * 1. Claude mit web_search recherchiert Unternehmen (gibt Fließtext zurück)
 * 2. Zweiter Claude-Call formatiert die Recherche als reines JSON-Array
 */
async function callClaudeWithSearch(researchPrompt: string, jsonSchema: string): Promise<string> {
  const messages: any[] = [{ role: "user", content: researchPrompt }];

  // ── Schritt 1: Websuche ──────────────────────────────────────────────────
  let researchText = "";

  for (let round = 0; round < 8; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: "Du bist ein professioneller B2B-Rechercheur. Nutze das Web-Suche-Tool um ECHTE Unternehmen zu finden. Beschreibe deine Ergebnisse detailliert mit Name, Adresse, Website, Telefon und Quelle.",
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages,
      }),
    });

    if (!res.ok) throw new Error(`Claude API Fehler (${res.status}): ${await res.text()}`);
    const data = await res.json();
    messages.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "end_turn") {
      const textBlock = data.content.find((b: any) => b.type === "text");
      researchText = textBlock?.text ?? "";
      break;
    }

    if (data.stop_reason === "tool_use") {
      const toolUseBlocks = data.content.filter((b: any) => b.type === "tool_use");
      const toolResults = toolUseBlocks.map((tu: any) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: tu.output ?? "Keine Ergebnisse.",
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  if (!researchText) throw new Error("Keine Recherche-Ergebnisse von Claude erhalten");

  // ── Schritt 2: JSON-Formatierung ─────────────────────────────────────────
  const jsonText = await callClaude(
    "Du bist ein Daten-Extraktor. Deine einzige Aufgabe: strukturierte Daten aus einem Text als JSON-Array ausgeben. Antworte NUR mit dem JSON-Array, ohne jeden anderen Text.",
    `Extrahiere alle Unternehmen aus dem folgenden Recherche-Text und gib sie als JSON-Array aus.

Recherche-Text:
${researchText}

Gewünschtes JSON-Schema pro Eintrag:
${jsonSchema}

WICHTIG: Antworte ausschließlich mit dem JSON-Array. Kein Text davor, kein Text danach.`
  );

  return extractJsonArray(jsonText);
}

async function saveLead(
  supabase: ReturnType<typeof createClient>,
  lead: KiLead,
  venture: string
): Promise<{ saved?: true; id?: string; duplicate?: boolean; error?: string }> {
  let isDuplicate = false;

  // Duplikat-Check via E-Mail
  if (lead.email && !lead.email.includes("placeholder.invalid")) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("email", lead.email.toLowerCase())
      .eq("venture", venture)
      .maybeSingle();
    if (existing) isDuplicate = true;
  }

  // Duplikat-Check via Firmenname
  if (!isDuplicate && lead.company_name) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .ilike("company_name", lead.company_name.trim())
      .eq("venture", venture)
      .maybeSingle();
    if (existing) isDuplicate = true;
  }

  // Adresse + Quelle zusammenbauen für notes
  const addressParts = [
    lead.street?.trim(),
    [lead.postal_code?.trim(), lead.city?.trim()].filter(Boolean).join(" "),
  ].filter(Boolean);

  const addressLine = addressParts.length > 0
    ? `📍 ${addressParts.join(", ")}`
    : "";

  const sourceLine = lead.source_url
    ? `🔗 Gefunden auf: ${lead.source_url}`
    : "";

  const reasonLine = lead.notes?.trim() || "";

  const fullNotes = [addressLine, sourceLine, reasonLine]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("leads")
    .insert({
      venture,
      first_name: lead.first_name?.trim() || "Unbekannt",
      last_name: lead.last_name?.trim() || "",
      company_name: lead.company_name?.trim() || null,
      email: lead.email?.toLowerCase().trim() || `ki-suche-${Date.now()}@placeholder.invalid`,
      phone: lead.phone?.trim() || null,
      website: lead.website?.trim() || null,
      city: lead.city?.trim() || null,
      industry: lead.industry?.trim() || null,
      notes: fullNotes || null,
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
  console.log(`[${cfg.venture}] Suche ${cfg.limit} echte Leads in ${cfg.region}...`);

  const researchPrompt = `Recherchiere ${cfg.limit} ECHTE, existierende Unternehmen in ${cfg.region}.

Zielgruppe: ${cfg.focus}
Branchen-Fokus: ${cfg.industry_hint}

Suche mit dem Web-Suche-Tool. Gute Suchanfragen:
- "${cfg.industry_hint} ${cfg.region} Adresse Kontakt"
- "${cfg.industry_hint} ${cfg.region} Impressum"

Für jedes gefundene Unternehmen notiere: Firmenname, Ansprechpartner (falls bekannt), Adresse (Straße, PLZ, Stadt), Telefon, E-Mail, Website und die URL wo du es gefunden hast.`;

  const jsonSchema = `{
  "first_name": "Vorname Ansprechpartner oder 'Inhaber'",
  "last_name": "Nachname oder leer",
  "company_name": "Firmenname",
  "email": "E-Mail oder leer",
  "phone": "Telefon oder leer",
  "website": "Website-URL oder leer",
  "city": "Stadt",
  "postal_code": "PLZ oder leer",
  "street": "Straße + Hausnummer oder leer",
  "industry": "Branche",
  "notes": "${cfg.note_hint}",
  "source_url": "Konkrete URL wo der Lead gefunden wurde"
}`;

  let leads: KiLead[];
  try {
    const raw = await callClaudeWithSearch(researchPrompt, jsonSchema);
    leads = JSON.parse(raw);
    if (!Array.isArray(leads)) throw new Error("Kein Array");
  } catch (err) {
    console.error(`[${cfg.venture}] Fehler bei Claude-Suche:`, err);
    return { venture: cfg.venture, saved: 0, duplicates: 0, errors: 1 };
  }

  let saved = 0, duplicates = 0, errors = 0;
  for (const lead of leads) {
    const result = await saveLead(supabase, lead, cfg.venture);
    if (result.saved) {
      saved++;
      if (result.duplicate) duplicates++;
      console.log(`[${cfg.venture}] ✅ ${lead.company_name || lead.first_name} (${lead.city})`);
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
    focus: "Lokale Unternehmen die keine moderne Website haben oder deren Website veraltet ist",
    industry_hint: "Einzelhandel, Handwerk, Gastronomie, Friseursalons, Reinigungen, lokale Dienstleister",
    note_hint: "Warum dieses Unternehmen eine professionelle Website braucht (1-2 Sätze)",
  },
  {
    venture: "brandary",
    enabled: false,
    limit: 5,
    region: "Hessen",
    focus: "Unternehmen und Vereine die regelmäßig Druckprodukte benötigen",
    industry_hint: "Gastronomiebetriebe, Eventveranstalter, Sportvereine, lokale Unternehmen, Handwerksbetriebe",
    note_hint: "Welche Druckprodukte dieses Unternehmen braucht und warum (1-2 Sätze)",
  },
  {
    venture: "droplane",
    enabled: false,
    limit: 5,
    region: "Deutschland",
    focus: "Content Creator, Fotografen, Videografen, YouTuber, Podcaster mit Reichweite",
    industry_hint: "Fotografie, Videoproduktion, Social Media, Blogging, Podcasting",
    note_hint: "Was dieser Creator macht und warum er Droplane braucht (1-2 Sätze)",
  },
  {
    venture: "blazed_outfitters",
    enabled: false,
    limit: 5,
    region: "Deutschland",
    focus: "Fashion Boutiquen, Streetwear-Shops, Skateshops als B2B-Partner",
    industry_hint: "Fashion Boutiquen, Streetwear, Skateboarding, Concept Stores",
    note_hint: "Warum dieser Shop ein guter Partner für Blazed Outfitters wäre (1-2 Sätze)",
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

  // Venture-Configs aus DB lesen
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

  console.log(`KI-Lead-Suche (mit Websuche): ${activeVentures.length} aktive Venture(s)`);

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
