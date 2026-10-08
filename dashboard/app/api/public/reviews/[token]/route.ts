import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashReviewToken, validateReviewSubmission } from "@/lib/review-domain";

type Params = { params: Promise<{ token: string }> };

async function invitationForToken(token: string) {
  const tokenHash = hashReviewToken(token);
  return supabaseAdmin
    .from("review_invitations")
    .select("id,venture,customer_id,order_id,email,customer_name,review_type,status,expires_at,orders(title)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
}

function unavailable(message: string, status = 404) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { data, error } = await invitationForToken(token);
  if (error || !data) return unavailable("Diese Bewertungseinladung wurde nicht gefunden.");
  if (data.status === "completed") return unavailable("Diese Einladung wurde bereits verwendet.", 409);
  if (["expired", "cancelled"].includes(data.status) || new Date(data.expires_at) < new Date()) {
    return unavailable("Diese Bewertungseinladung ist nicht mehr gültig.", 410);
  }
  if (data.status === "pending" || data.status === "sent") {
    await supabaseAdmin.from("review_invitations").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", data.id);
  }
  return NextResponse.json({
    venture: data.venture,
    customer_name: data.customer_name,
    review_type: data.review_type,
    order_title: (data.orders as unknown as { title?: string } | null)?.title ?? null,
    expires_at: data.expires_at,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { data: invitation, error } = await invitationForToken(token);
  if (error || !invitation) return unavailable("Diese Bewertungseinladung wurde nicht gefunden.");
  if (invitation.status === "completed") return unavailable("Diese Einladung wurde bereits verwendet.", 409);
  if (["expired", "cancelled"].includes(invitation.status) || new Date(invitation.expires_at) < new Date()) {
    return unavailable("Diese Bewertungseinladung ist nicht mehr gültig.", 410);
  }

  const body = await req.json().catch(() => null);
  const validation = validateReviewSubmission(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const categoryInput = (body && typeof body === "object" && "category_ratings" in body)
    ? (body as { category_ratings?: Record<string, unknown> }).category_ratings ?? {}
    : {};
  const categoryRatings: Record<string, number> = {};
  for (const key of ["quality", "communication", "delivery"]) {
    const value = Number(categoryInput[key]);
    if (Number.isInteger(value) && value >= 1 && value <= 5) categoryRatings[key] = value;
  }

  const { data: review, error: insertError } = await supabaseAdmin
    .from("reviews")
    .insert({
      venture: invitation.venture,
      invitation_id: invitation.id,
      customer_id: invitation.customer_id,
      order_id: invitation.order_id,
      review_type: invitation.review_type,
      ...validation.value,
      category_ratings: categoryRatings,
      is_verified: true,
      status: "pending",
      source: "founder_os",
    })
    .select("id,status,submitted_at")
    .single();
  if (insertError || !review) {
    if (insertError?.code === "23505") return unavailable("Diese Einladung wurde bereits verwendet.", 409);
    return NextResponse.json({ error: insertError?.message || "Bewertung konnte nicht gespeichert werden." }, { status: 500 });
  }

  await supabaseAdmin.from("review_invitations").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", invitation.id);

  return NextResponse.json({ success: true, review }, { status: 201 });
}
