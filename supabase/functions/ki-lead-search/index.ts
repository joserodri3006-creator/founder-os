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
 * Ruft Claude mit web_search Tool auf — agentic loop bis finale Antwort.
 * Claude sucht aktiv im Web nach echten Unternehmen.
 */
async function callClaudeWithSearch(system: string, userPrompt: string): Promise<string> {
  const messages: any[] = [{ role: "user", content: userPrompt }];

  // Maximal 6 Runden (web_search kann mehrfach aufgerufen werden)
  for (let round = 0; round < 6; round++) {
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
        system,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
        ],
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API Fehler (${res.status}): ${errText}`);
    }

    const data = await res.json();

    // Antwort zur Message-History hinzufügen
    messages.push({ role: "assistant", content: data.content });

    // Prüfen ob Claude fertig ist (stop_reason = "end_turn")
    if (data.stop_reason === "end_turn") {
      // Letzten Text-Block aus der Antwort holen
      const textBlock = data.content.find((b: any) => b.type === "text");
      if (textBlock) {
        return textBlock.text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();
      }
      throw new Error("Kein Text-Block in finaler Antwort");
    }

    // tool_use Blöcke verarbeiten (web search Ergebnisse zurückgeben)
    if (data.stop_reason === "tool_use") {
      const toolUseBlocks = data.content.filter((b: any) => b.type === "tool_use");
      const toolResults: any[] = [];

      for (const toolUse of toolUseBlocks) {
        // web_search liefert Ergebnisse automatisch via API — wir geben das Ergebnis zurück
        // Das Ergebnis ist bereits im tool_use Block enthalten (server-side execution)
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: toolUse.output ?? "Suchergebnisse wurden verarbeitet.",
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unbekannter stop_reason
    break;
  }

  throw new Error("Agentic loop: Maximale Runden erreicht ohne finale Antwort");
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

  const system = `Du bist ein professioneller B2B-Rechercheur.
Deine Aufgabe: ECHTE, existierende Unternehmen und Ansprechpartner finden — keine erfundenen Namen.

Nutze das Web-Suche-Tool um aktuelle, verifizierbare Ergebnisse zu liefern.

Antworte am Ende AUSSCHLIESSLICH mit einem validen JSON-Array.
Kein erklärender Text davor oder danach, keine Markdown-Codeblöcke.`;

  const prompt = `Finde ${cfg.limit} ECHTE, existierende Unternehmen oder Personen in ${cfg.region}.

Zielgruppe: ${cfg.focus}
Branchen-Fokus: ${cfg.industry_hint}

Suche aktiv mit dem Web-Suche-Tool nach realen Ergebnissen.
Beispiel-Suchanfragen:
- "${cfg.industry_hint} ${cfg.region} Kontakt Adresse"
- "${cfg.focus.slice(0, 60)} ${cfg.region} website"

Für jeden gefundenen Lead extrahiere folgende Daten aus den Suchergebnissen:

[
  {
    "first_name": "Vorname des Ansprechpartners (oder leer)",
    "last_name": "Nachname des Ansprechpartners (oder leer)",
    "company_name": "Echter Firmenname",
    "email": "E-Mail falls auf der Website sichtbar, sonst leer",
    "phone": "Telefonnummer falls gefunden, sonst leer",
    "website": "Offizielle Website-URL",
    "city": "Stadt",
    "postal_code": "Postleitzahl falls gefunden",
    "street": "Straße + Hausnummer falls gefunden",
    "industry": "Branche",
    "notes": "${cfg.note_hint}",
    "source_url": "Die genaue URL der Webseite wo du diesen Lead gefunden hast"
  }
]

Wichtige Regeln:
- NUR echte, verifizierbare Unternehmen — nichts erfinden
- source_url MUSS die konkrete URL sein (Google Maps Link, Website-Impressum, LinkedIn etc.)
- Wenn kein Ansprechpartner bekannt: first_name = "Inhaber", last_name leer lassen
- Adresse (street, postal_code) so vollständig wie möglich aus den Suchergebnissen
- Gib genau ${cfg.limit} Leads zurück`;

  let leads: KiLead[];
  try {
    const raw = await callClaudeWithSearch(system, prompt);
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
