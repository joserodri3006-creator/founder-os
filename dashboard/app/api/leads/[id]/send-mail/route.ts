import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";
import { statusAfterSuccessfulEmailSend } from "@/lib/lead-mail-state";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { subject, body, is_ai_draft_send } = await req.json();

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "subject und body erforderlich" }, { status: 400 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("first_name, last_name, email, venture, status")
    .eq("id", id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead hat keine E-Mail-Adresse" }, { status: 400 });

  const sender = getSender(lead.venture);
  const recipientName = `${lead.first_name} ${lead.last_name}`.trim();

  // Resend erlaubt nur verifizierte Domains als from-Adresse.
  // Falls die Venture-Domain (z.B. blazedoutfitters.com) noch nicht in Resend verifiziert
  // ist, senden wir von info@onlinefirst.eu mit reply_to auf die richtige Adresse,
  // damit Antworten trotzdem dort ankommen.
  const isVerifiedDomain = sender.email.endsWith("@onlinefirst.eu");
  const effectiveFrom  = isVerifiedDomain ? sender.email : "info@onlinefirst.eu";
  const effectiveName  = sender.name;
  const replyTo        = isVerifiedDomain ? undefined : sender.email;

  const resendRes = await sendMail(RESEND_API_KEY, {
    from: `${effectiveName} <${effectiveFrom}>`,
    to: [recipientName ? `${recipientName} <${lead.email}>` : lead.email],
    reply_to: replyTo,
    subject,
    text: body,
  });

  if (!resendRes.ok) {
    let raw = "";
    try { raw = await resendRes.text(); } catch { /* ignore */ }
    // Resend gibt JSON zurück: { name, message, statusCode } oder ähnlich
    let userMsg = `Resend ${resendRes.status}`;
    try {
      const parsed = JSON.parse(raw);
      userMsg = parsed?.message ?? parsed?.error ?? raw.slice(0, 200);
    } catch { if (raw) userMsg = raw.slice(0, 200); }
    return NextResponse.json(
      { error: "E-Mail-Versand fehlgeschlagen", detail: userMsg },
      { status: 500 }
    );
  }

  const sentAt = new Date().toISOString();
  const nextStatus = statusAfterSuccessfulEmailSend(lead.status);
  const nextFollowUpDate = new Date();
  nextFollowUpDate.setDate(nextFollowUpDate.getDate() + 5);
  const followUpDateUpdate = nextStatus === "follow_up"
    ? nextFollowUpDate.toISOString().split("T")[0]
    : nextStatus === "nachgefasst" ? null : undefined;

  const { error: updateError } = await supabaseAdmin
    .from("leads")
    .update({
      status: nextStatus,
      last_contacted_at: sentAt,
      ...(is_ai_draft_send
        ? { ai_draft_subject: subject, ai_draft_body: body, ai_draft_approved: true }
        : {}),
      ...(followUpDateUpdate !== undefined ? { follow_up_date: followUpDateUpdate } : {}),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `E-Mail wurde versendet, aber der Lead-Status konnte nicht aktualisiert werden: ${updateError.message}` },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("lead_activities").insert({
    lead_id: id,
    activity_type: "email_sent",
    description: `Betreff: ${subject}`,
  });

  return NextResponse.json({ success: true, status: nextStatus, sent_at: sentAt });
}
