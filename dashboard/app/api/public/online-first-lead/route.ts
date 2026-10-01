import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanText, enforcePublicRateLimit } from "@/lib/public-sales";

const ALLOWED_ORIGINS = new Set([
  "https://online-first-three.vercel.app",
  "https://onlinefirst.eu",
  "https://founder-os-theta.vercel.app",
]);

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://onlinefirst.eu",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first_name: parts[0] || "Online First", last_name: "Web Anfrage" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts.at(-1) || "Web Anfrage" };
}

function plainMailBody(fields: Record<string, string>, leadId?: string) {
  return [
    "Neue Online First Anfrage über die Webseite",
    "",
    `Name: ${fields.name}`,
    `Unternehmen: ${fields.company_name || "Nicht angegeben"}`,
    `E-Mail: ${fields.email}`,
    `Telefon: ${fields.phone || "Nicht angegeben"}`,
    `Bestehende Website: ${fields.website || "Nicht angegeben"}`,
    `Anliegen: ${fields.project_type || "Nicht angegeben"}`,
    `Budget: ${fields.budget || "Nicht angegeben"}`,
    `Zeitrahmen: ${fields.timeline || "Nicht angegeben"}`,
    "",
    "Nachricht:",
    fields.message,
    "",
    leadId ? `Founder OS Lead: /leads/${leadId}` : "",
  ].filter(Boolean).join("\n");
}

async function sendResendMail(payload: { from: string; to: string[]; subject: string; text: string; reply_to?: string[] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY fehlt" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Resend ${response.status}: ${text}`);
  return { sent: true };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(req, { error: "Origin nicht erlaubt" }, 403);
  }

  try {
    const rateLimit = await enforcePublicRateLimit(req, "online_first_web_lead", 8);
    if (rateLimit) return new NextResponse(await rateLimit.text(), { status: rateLimit.status, headers: corsHeaders(req) });
  } catch (error) {
    console.warn("public_request_limits unavailable", error);
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonResponse(req, { error: "Ungueltige Anfrage" }, 400);

  // Honeypot: unsichtbares Feld, das nur Bots ausfuellen
  const honeypot = cleanText(body.fax, 200);
  if (honeypot) return jsonResponse(req, { success: true });

  const fields = {
    name: cleanText(body.name, 160),
    company_name: cleanText(body.company_name, 180),
    email: cleanText(body.email, 254).toLowerCase(),
    phone: cleanText(body.phone, 80),
    website: cleanText(body.website, 300),
    project_type: Array.isArray(body.project_type)
      ? body.project_type.map((value) => cleanText(value, 80)).filter(Boolean).join(", ")
      : cleanText(body.project_type, 300),
    budget: cleanText(body.budget, 120),
    timeline: cleanText(body.timeline, 120),
    message: cleanText(body.message, 2000),
  };

  if (!fields.name || !fields.email || !fields.message) {
    return jsonResponse(req, { error: "Name, E-Mail und Nachricht sind erforderlich" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return jsonResponse(req, { error: "Bitte geben Sie eine gueltige E-Mail-Adresse ein" }, 400);
  }

  const { first_name, last_name } = splitName(fields.name);
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("venture", "online_first")
    .eq("email", fields.email)
    .maybeSingle();

  const notes = [
    "Webseiten-Anfrage Online First",
    `Bestehende Website: ${fields.website || "Nicht angegeben"}`,
    `Anliegen: ${fields.project_type || "Nicht angegeben"}`,
    `Budget: ${fields.budget || "Nicht angegeben"}`,
    `Zeitrahmen: ${fields.timeline || "Nicht angegeben"}`,
    "",
    fields.message,
  ].join("\n");

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert({
      venture: "online_first",
      first_name,
      last_name,
      email: fields.email,
      phone: fields.phone || null,
      company_name: fields.company_name || null,
      website: fields.website || null,
      source: "website",
      status: "neu",
      industry: "Webseiten-Anfrage",
      contact_reason: fields.project_type || null,
      notes,
      region: "Hessen",
      automation_enabled: true,
      is_duplicate: Boolean(existing),
      review_status: "unreviewed",
      contact_channel: "email_ok",
      next_action: "fit_check_senden",
    })
    .select("id, first_name, last_name, email, status, created_at")
    .single();

  if (error || !lead) {
    return jsonResponse(req, { error: error?.message || "Lead konnte nicht gespeichert werden" }, 500);
  }

  const { data: tag, error: tagError } = await supabaseAdmin
    .from("lead_tags")
    .upsert({ venture: "online_first", name: "Kontaktformular" }, { onConflict: "venture,name" })
    .select("id")
    .single();

  if (!tagError && tag?.id) {
    await supabaseAdmin.from("lead_tag_map").upsert({ lead_id: lead.id, tag_id: tag.id });
  }

  await supabaseAdmin.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "webform_received",
    description: "Online First Webseiten-Anfrage eingegangen und als Lead gespeichert",
  }).then(() => null);

  const shouldNotify = lead.status === "neu" && !tagError && tag?.id;
  let mailStatus: unknown = { skipped: true };
  if (shouldNotify) {
    const detailText = plainMailBody(fields, lead.id);
    const customerText = [
      `Hallo ${first_name},`,
      "",
      "vielen Dank für Ihre Anfrage bei Online First.",
      "Wir haben Ihre Angaben erhalten und melden uns zeitnah mit Rückfragen oder einem passenden Vorschlag.",
      "",
      "Ihre Angaben:",
      detailText.replace("Neue Online First Anfrage über die Webseite\n\n", ""),
      "",
      "Online First",
      "info@onlinefirst.eu",
    ].join("\n");

    const internalText = detailText;
    const from = "Online First <info@onlinefirst.eu>";
    const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "jose.rodri3006@gmail.com";
    const customerMail = sendResendMail({
      from,
      to: [fields.email],
      subject: "Ihre Anfrage bei Online First ist angekommen",
      text: customerText,
      reply_to: ["info@onlinefirst.eu"],
    });
    const internalMail = sendResendMail({
      from,
      to: [FOUNDER_EMAIL],
      subject: "Neue Online First Anfrage über die Webseite",
      text: internalText,
      reply_to: [fields.email],
    });
    mailStatus = await Promise.allSettled([customerMail, internalMail]);
  }

  return jsonResponse(req, { success: true, lead_id: lead.id, duplicate: Boolean(existing), mail: mailStatus }, 201);
}
