import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ReviewInvitationInput = {
  venture: string;
  customerId: string | null;
  orderId: string;
  email: string;
  customerName: string;
  orderTitle: string;
};

/** Tage zwischen Auftragsabschluss und Einladung (Konzept: 3 bis 7 Tage). */
const DEFAULT_DELAY_DAYS = 3;

/**
 * Legt eine Einladung ohne ausgegebenen Token an. Der Versand erfolgt durch den
 * Hermes-Worker (KAS-Postfach des Ventures): Er erzeugt den Einmal-Token, speichert
 * nur dessen SHA-256-Hash und versendet den Link. So liegt der Link nie im Klartext
 * in der Datenbank und Vercel braucht keine Postfach-Zugangsdaten.
 */
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

  const delayDays = Number(process.env.REVIEW_INVITE_DELAY_DAYS ?? DEFAULT_DELAY_DAYS);
  const sendAfter = new Date(Date.now() + Math.max(0, delayDays) * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(Date.now() + (Math.max(0, delayDays) + 60) * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error } = await supabaseAdmin
    .from("review_invitations")
    .insert({
      venture: input.venture,
      customer_id: input.customerId,
      order_id: input.orderId,
      email: input.email.trim().toLowerCase(),
      customer_name: input.customerName || null,
      token_hash: `unissued:${crypto.randomUUID()}`,
      review_type: "order",
      status: "pending",
      send_after: sendAfter,
      expires_at: expiresAt,
    })
    .select("id,status,send_after,expires_at")
    .single();
  if (error || !invitation) throw new Error(error?.message || "Bewertungseinladung konnte nicht angelegt werden");

  return { created: true, invitation, queued: true as const, send_after: sendAfter };
}
