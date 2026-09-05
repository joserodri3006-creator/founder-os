import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanText, enforcePublicRateLimit } from "@/lib/public-sales";

const ALLOWED_ORIGINS = new Set([
  "https://bybrandary.de",
  "https://www.bybrandary.de",
]);

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://bybrandary.de",
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
  if (parts.length <= 1) return { first_name: parts[0] || "Brandary", last_name: "Web Anfrage" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts.at(-1) || "Web Anfrage" };
}

function plainMailBody(fields: Record<string, string>, leadId?: string) {
  return [
    "Neue Brandary Anfrage über die Webseite",
    "",
    `Name: ${fields.name}`,
    `Unternehmen: ${fields.company_name || "Nicht angegeben"}`,
    `E Mail: ${fields.email}`,
    `Telefon: ${fields.phone || "Nicht angegeben"}`,
    `Bedarf: ${fields.need || "Nicht angegeben"}`,
    `Stückzahl: ${fields.quantity || "Nicht angegeben"}`,
    `Gewünschter Termin: ${fields.desired_date || "Nicht angegeben"}`,
    `Logo oder Datei Link: ${fields.logo_url || "Nicht angegeben"}`,
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
    const rateLimit = await enforcePublicRateLimit(req, "brandary_web_lead", 8);
    if (rateLimit) return new NextResponse(await rateLimit.text(), { status: rateLimit.status, headers: corsHeaders(req) });
  } catch (error) {
    console.warn("public_request_limits unavailable", error);
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonResponse(req, { error: "Ungueltige Anfrage" }, 400);

  const honeypot = cleanText(body.website_url, 200);
  if (honeypot) return jsonResponse(req, { success: true });

  const fields = {
    name: cleanText(body.name, 160),
    company_name: cleanText(body.company_name, 180),
    email: cleanText(body.email, 254).toLowerCase(),
    phone: cleanText(body.phone, 80),
    need: Array.isArray(body.need)
      ? body.need.map((value) => cleanText(value, 80)).filter(Boolean).join(", ")
      : cleanText(body.need, 300),
    quantity: cleanText(body.quantity, 80),
    desired_date: cleanText(body.desired_date, 120),
    logo_url: cleanText(body.logo_url, 500),
    message: cleanText(body.message, 2000),
  };

  if (!fields.name || !fields.email || !fields.message) {
    return jsonResponse(req, { error: "Name, E Mail und Nachricht sind erforderlich" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return jsonResponse(req, { error: "Bitte geben Sie eine gueltige E Mail Adresse ein" }, 400);
  }

  const { first_name, last_name } = splitName(fields.name);
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("venture", "brandary")
    .eq("email", fields.email)
    .maybeSingle();

  const notes = [
    "Webseiten Anfrage Brandary",
    `Bedarf: ${fields.need || "Nicht angegeben"}`,
    `Stückzahl: ${fields.quantity || "Nicht angegeben"}`,
    `Gewünschter Termin: ${fields.desired_date || "Nicht angegeben"}`,
    `Logo oder Datei Link: ${fields.logo_url || "Nicht angegeben"}`,
    "",
    fields.message,
  ].join("\n");

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert({
      venture: "brandary",
      first_name,
      last_name,
      email: fields.email,
      phone: fields.phone || null,
      company_name: fields.company_name || null,
      source: "website",
      status: "neu",
      industry: "Webseiten Anfrage",
      contact_reason: fields.need || null,
      notes,
      region: "Hessen",
      automation_enabled: true,
      is_duplicate: Boolean(existing),
      review_status: "unreviewed",
      contact_channel: "email_ok",
      next_action: "erstansprache_vorbereiten",
    })
    .select("id, first_name, last_name, email, status, created_at")
    .single();

  if (error || !lead) {
    return jsonResponse(req, { error: error?.message || "Lead konnte nicht gespeichert werden" }, 500);
  }

  const { data: tag, error: tagError } = await supabaseAdmin
    .from("lead_tags")
    .upsert({ venture: "brandary", name: "Webseite" }, { onConflict: "venture,name" })
    .select("id")
    .single();

  if (!tagError && tag?.id) {
    await supabaseAdmin.from("lead_tag_map").upsert({ lead_id: lead.id, tag_id: tag.id });
  }

  await supabaseAdmin.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "webform_received",
    description: "Brandary Webseiten Anfrage eingegangen und als Lead gespeichert",
  }).then(() => null);

  const shouldNotify = lead.status === "neu" && !tagError && tag?.id;
  let mailStatus: unknown = { skipped: true };
  if (shouldNotify) {
    const detailText = plainMailBody(fields, lead.id);
    const customerText = [
      `Hallo ${first_name},`,
      "",
      "vielen Dank für Ihre Anfrage bei Brandary.",
      "Wir haben Ihre Projektdaten erhalten und melden uns zeitnah mit Rückfragen oder einem passenden Angebot.",
      "",
      "Ihre Angaben:",
      detailText.replace("Neue Brandary Anfrage über die Webseite\n\n", ""),
      "",
      "Brandary",
      "info@bybrandary.de",
    ].join("\n");

    const internalText = detailText;
    const from = "Brandary <info@onlinefirst.eu>";
    const customerMail = sendResendMail({
      from,
      to: [fields.email],
      subject: "Ihre Anfrage bei Brandary ist angekommen",
      text: customerText,
      reply_to: ["info@bybrandary.de"],
    });
    const internalMail = sendResendMail({
      from,
      to: ["info@bybrandary.de"],
      subject: "Neue Brandary Anfrage über die Webseite",
      text: internalText,
      reply_to: [fields.email],
    });
    mailStatus = await Promise.allSettled([customerMail, internalMail]);
  }

  return jsonResponse(req, { success: true, lead_id: lead.id, duplicate: Boolean(existing), mail: mailStatus }, 201);
}
