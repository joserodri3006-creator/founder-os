import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getSenderForVenture(venture: string | null): Promise<{ name: string; email: string }> {
  const fallback = { name: "Jose | Online First", email: "info@onlinefirst.eu" };
  if (!venture) return fallback;

  const { data } = await supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", "ki_search_ventures")
    .single();

  if (!data?.value) return fallback;

  try {
    const ventures: Array<{ venture: string; sender_name?: string; sender_email?: string }> =
      JSON.parse(data.value);
    const match = ventures.find((v) => v.venture === venture);
    if (match?.sender_name && match?.sender_email) {
      return { name: match.sender_name, email: match.sender_email };
    }
  } catch { /* ignore */ }

  return fallback;
}

export async function POST(req: NextRequest) {
  const { lead_id, subject, body } = await req.json();

  if (!lead_id || !subject || !body) {
    return NextResponse.json({ error: "lead_id, subject und body erforderlich" }, { status: 400 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("first_name, last_name, email, venture")
    .eq("id", lead_id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  }

  const sender = await getSenderForVenture(lead.venture);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${sender.name} <${sender.email}>`,
      to: [`${lead.first_name} ${lead.last_name} <${lead.email}>`],
      subject,
      text: body,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error("Resend Fehler:", err);
    return NextResponse.json({ error: "E-Mail-Versand fehlgeschlagen", detail: err }, { status: 500 });
  }

  await supabaseAdmin
    .from("leads")
    .update({
      ai_draft_subject: subject,
      ai_draft_body: body,
      ai_draft_approved: true,
      status: "kontaktiert",
    })
    .eq("id", lead_id);

  return NextResponse.json({ success: true });
}
