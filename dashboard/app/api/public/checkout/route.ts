import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ONLINE_FIRST_PACKAGE, enforcePublicRateLimit, salesError } from "@/lib/public-sales";

interface CheckoutBody {
  submission_id?: string;
  terms_accepted?: boolean;
  b2b_confirmed?: boolean;
}

export async function POST(req: NextRequest) {
  const limited = await enforcePublicRateLimit(req, "checkout", 8);
  if (limited) return limited;

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!stripeSecret || !siteUrl || process.env.ONLINE_FIRST_LEGAL_APPROVED !== "true") {
    return salesError("Der Online-Checkout ist noch nicht konfiguriert.", 503);
  }

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return salesError("Ungueltige Anfrage.");
  }

  if (!body.submission_id || body.terms_accepted !== true || body.b2b_confirmed !== true) {
    return salesError("B2B-Bestaetigung und Vertragsbedingungen sind erforderlich.");
  }

  const { data: submission, error } = await supabaseAdmin
    .from("sales_submissions")
    .select("id,lead_id,email,fit_status,first_name,last_name")
    .eq("id", body.submission_id)
    .single();

  if (error || !submission || submission.fit_status !== "checkout_ready") {
    return salesError("Dieses Projekt benoetigt vor dem Kauf ein Gespraech.", 409);
  }

  const { data: existing } = await supabaseAdmin
    .from("sales_checkout_sessions")
    .select("checkout_url,status")
    .eq("submission_id", submission.id)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.checkout_url) {
    return NextResponse.json({ checkout_url: existing.checkout_url });
  }

  const stripeParams = new URLSearchParams({
    mode: "payment",
    customer_email: submission.email,
    success_url: `${siteUrl}/online-first/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/online-first/fit?checkout=abgebrochen`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(ONLINE_FIRST_PACKAGE.depositNetCents),
    "line_items[0][price_data][tax_behavior]": "exclusive",
    "line_items[0][price_data][product_data][name]": `${ONLINE_FIRST_PACKAGE.label} - 50% Anzahlung`,
    "line_items[0][price_data][product_data][description]": "Anzahlung fuer das standardisierte 5-Seiten-Paket",
    "automatic_tax[enabled]": "true",
    "metadata[submission_id]": submission.id,
    "metadata[lead_id]": submission.lead_id,
    "metadata[package_code]": ONLINE_FIRST_PACKAGE.code,
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `online-first-${submission.id}-${ONLINE_FIRST_PACKAGE.termsVersion}`,
    },
    body: stripeParams,
  });
  const stripeSession = await stripeResponse.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !stripeSession.id || !stripeSession.url) {
    console.error("Stripe checkout creation failed:", stripeSession.error?.message);
    return salesError("Der Checkout konnte nicht gestartet werden.", 502);
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabaseAdmin.from("sales_checkout_sessions").insert({
    submission_id: submission.id,
    lead_id: submission.lead_id,
    stripe_session_id: stripeSession.id,
    checkout_url: stripeSession.url,
    amount_net_cents: ONLINE_FIRST_PACKAGE.depositNetCents,
    status: "created",
    terms_version: ONLINE_FIRST_PACKAGE.termsVersion,
    terms_accepted_at: now,
    b2b_confirmed_at: now,
  });
  if (insertError) return salesError("Die Checkout-Sitzung konnte nicht gespeichert werden.", 500);

  await supabaseAdmin.from("consent_events").insert([
    {
      submission_id: submission.id,
      lead_id: submission.lead_id,
      event_type: "terms",
      document_version: ONLINE_FIRST_PACKAGE.termsVersion,
      occurred_at: now,
    },
    {
      submission_id: submission.id,
      lead_id: submission.lead_id,
      event_type: "b2b_confirmation",
      document_version: ONLINE_FIRST_PACKAGE.termsVersion,
      occurred_at: now,
    },
  ]);

  await supabaseAdmin
    .from("leads")
    .update({ funnel_stage: "checkout_started" })
    .eq("id", submission.lead_id);

  return NextResponse.json({ checkout_url: stripeSession.url });
}
