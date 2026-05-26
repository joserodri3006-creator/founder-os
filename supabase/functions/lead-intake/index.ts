import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_SOURCES = ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"] as const;
const ALLOWED_VENTURES = ["online_first", "blazed_outfitters", "droplane", "brandary"] as const;
type LeadSource = typeof ALLOWED_SOURCES[number];
type Venture = typeof ALLOWED_VENTURES[number];

interface LeadPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  website?: string;
  city?: string;
  region?: string;
  industry?: string;
  contact_reason?: string;
  notes?: string;
  source?: LeadSource;
  venture?: Venture;
  automation_enabled?: boolean;
  turnstile_token?: string;
}

function cors(origin: string | null) {
  const permittedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN") ?? "";
  return {
    "Access-Control-Allow-Origin": origin && origin === permittedOrigin ? origin : permittedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  const permittedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");
  if (!permittedOrigin || (origin && origin !== permittedOrigin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let payload: LeadPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!turnstileSecret || !payload.turnstile_token) {
    return new Response(JSON.stringify({ error: "Security verification required" }), { status: 403, headers });
  }
  const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: turnstileSecret, response: payload.turnstile_token }),
  }).then((response) => response.json()).catch(() => ({ success: false }));
  if (!verification.success) {
    return new Response(JSON.stringify({ error: "Security verification failed" }), { status: 403, headers });
  }

  const { first_name, last_name, email } = payload;
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
    return new Response(
      JSON.stringify({ error: "first_name, last_name und email sind Pflichtfelder" }),
      { status: 400, headers }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "Ungueltige E-Mail-Adresse" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const venture: Venture = ALLOWED_VENTURES.includes(payload.venture as Venture)
    ? (payload.venture as Venture)
    : "online_first";

  const source: LeadSource = ALLOWED_SOURCES.includes(payload.source as LeadSource)
    ? (payload.source as LeadSource)
    : "website";

  // Duplikat-Check: gleiche E-Mail im gleichen Venture
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("venture", venture)
    .maybeSingle();

  const isDuplicate = !!existing;

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      venture,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.toLowerCase().trim(),
      phone: payload.phone?.trim() || null,
      company_name: payload.company_name?.trim() || null,
      website: payload.website?.trim() || null,
      city: payload.city?.trim() || null,
      region: payload.region?.trim() || "Hessen",
      industry: payload.industry?.trim() || null,
      contact_reason: payload.contact_reason?.trim() || null,
      notes: payload.notes?.trim() || null,
      source,
      status: "neu",
      automation_enabled: payload.automation_enabled ?? true,
      is_duplicate: isDuplicate,
    })
    .select("id, first_name, last_name, email, status, created_at")
    .single();

  if (error) {
    console.error("DB Insert Error:", error);
    return new Response(JSON.stringify({ error: "Datenbankfehler", detail: error.message }), { status: 500, headers });
  }

  // Lead-Qualifizierung asynchron triggern (nur bei nicht-Duplikat)
  if (!isDuplicate) {
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/lead-qualify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ lead_id: lead.id }),
    }).catch((e) => console.error("lead-qualify trigger fehlgeschlagen:", e));
  }

  // Notification: neuer Lead
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      venture:    payload.venture,
      event_type: "new_lead",
      title:      `Neuer Lead: ${lead.first_name} ${lead.last_name}`,
      body:       lead.email ?? undefined,
      link:       `/leads/${lead.id}`,
    }),
  }).catch((e) => console.error("send-notification fehlgeschlagen:", e));

  return new Response(
    JSON.stringify({ success: true, duplicate: isDuplicate, lead }),
    { status: 201, headers }
  );
});
