import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";
import { hashReviewToken } from "@/lib/review-domain";

export type ReviewInvitationInput = {
  venture: string;
  customerId: string | null;
  orderId: string;
  email: string;
  customerName: string;
  orderTitle: string;
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://founder-os-theta.vercel.app").replace(/\/$/, "");
}

export async function createReviewInvitation(input: ReviewInvitationInput) {
  const existing = await supabaseAdmin
    .from("review_invitations")
    .select("id,status,sent_at,completed_at,expires_at")
    .eq("order_id", input.orderId)
    .eq("review_type", "order")
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { created: false, invitation: existing.data, reason: "exists" as const };

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashReviewToken(token);
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error } = await supabaseAdmin
    .from("review_invitations")
    .insert({
      venture: input.venture,
      customer_id: input.customerId,
      order_id: input.orderId,
      email: input.email.trim().toLowerCase(),
      customer_name: input.customerName || null,
      token_hash: tokenHash,
      review_type: "order",
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id,status,expires_at")
    .single();
  if (error || !invitation) throw new Error(error?.message || "Bewertungseinladung konnte nicht angelegt werden");

  const url = `${siteUrl()}/bewerten/${token}`;
  const apiKey = process.env.RESEND_API_KEY;
  let sent = false;
  let warning: string | null = null;
  if (apiKey) {
    const sender = getSender(input.venture);
    const firstName = input.customerName.trim().split(/\s+/)[0] || "Hallo";
    const text = [
      `Hallo ${firstName},`,
      "",
      `vielen Dank für Ihre Bestellung bei ${sender.name}.`,
      "Wir möchten ehrlich erfahren, wie Sie Ihre Erfahrung bewerten. Ihre Rückmeldung darf positiv, neutral oder kritisch sein und hilft uns, unseren Service zu verbessern.",
      "",
      `Bewertung abgeben: ${url}`,
      "",
      "Die Teilnahme ist freiwillig. Es gibt keine Belohnung und die Bewertung wird erst nach Ihrer ausdrücklichen Freigabe öffentlich angezeigt.",
      "",
      `Viele Grüße`,
      sender.name,
    ].join("\n");
    const response = await sendMail(apiKey, {
      from: `${sender.name} <${sender.email}>`,
      to: [input.email],
      subject: `Wie war Ihre Erfahrung mit ${sender.name}?`,
      text,
    });
    if (response.ok) {
      sent = true;
      await supabaseAdmin.from("review_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invitation.id);
    } else {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      warning = `Einladung gespeichert, E-Mail-Versand fehlgeschlagen (${response.status}) von ${sender.email}: ${detail}`;
    }
  } else {
    warning = "Einladung gespeichert, RESEND_API_KEY fehlt";
  }

  return { created: true, invitation, token, url, sent, warning };
}
