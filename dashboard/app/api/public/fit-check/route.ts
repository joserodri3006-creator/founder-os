import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ONLINE_FIRST_PACKAGE,
  attributionFrom,
  cleanText,
  enforcePublicRateLimit,
  evaluateFit,
  salesError,
  validateFitInput,
  verifyTurnstile,
  type FitInput,
} from "@/lib/public-sales";

export async function POST(req: NextRequest) {
  let input: FitInput;
  try {
    input = await req.json();
  } catch {
    return salesError("Ungueltige Anfrage.");
  }

  if (cleanText(input.website_confirmation)) {
    return NextResponse.json({ success: true, status: "call_recommended" });
  }

  const validationError = validateFitInput(input);
  if (validationError) return salesError(validationError);
  const fit = evaluateFit(input);

  if (process.env.ONLINE_FIRST_PREVIEW_MODE === "true") {
    return NextResponse.json({
      success: true,
      preview: true,
      submission_id: `preview-${Date.now()}`,
      status: fit.status,
      score: fit.score,
      reason: fit.reason,
    }, { status: 201 });
  }

  const limited = await enforcePublicRateLimit(req, "fit-check", 5);
  if (limited) return limited;
  if (!await verifyTurnstile(req, input.turnstile_token)) {
    return salesError("Die Sicherheitspruefung ist fehlgeschlagen.", 403);
  }

  const email = cleanText(input.email, 254).toLowerCase();
  const now = new Date().toISOString();
  const attribution = attributionFrom(input, req);

  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("email", email)
    .eq("venture", "online_first")
    .maybeSingle();

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      venture: "online_first",
      first_name: cleanText(input.first_name, 100),
      last_name: cleanText(input.last_name, 100),
      email,
      company_name: cleanText(input.company_name, 200) || null,
      website: cleanText(input.website, 500) || null,
      industry: cleanText(input.profession, 100) || "Beratung / Coaching",
      contact_reason: "Online First Authority Website Sprint Projekt-Fit",
      source: "website",
      status: "neu",
      automation_enabled: false,
      is_duplicate: Boolean(existing),
      funnel_stage: "fit_completed",
      fit_status: fit.status,
      fit_score: fit.score,
      privacy_consent_at: now,
      marketing_consent_at: input.marketing_consent ? now : null,
      attribution,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    console.error("Fit-check lead insert failed:", leadError?.message);
    return salesError("Ihre Anfrage konnte nicht gespeichert werden.", 500);
  }

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("sales_submissions")
    .insert({
      venture: "online_first",
      lead_id: lead.id,
      package_code: ONLINE_FIRST_PACKAGE.code,
      package_price_net_cents: ONLINE_FIRST_PACKAGE.netPriceCents,
      first_name: cleanText(input.first_name, 100),
      last_name: cleanText(input.last_name, 100),
      email,
      company_name: cleanText(input.company_name, 200) || null,
      website: cleanText(input.website, 500) || null,
      profession: cleanText(input.profession, 100) || null,
      offer_description: cleanText(input.offer_description, 1000),
      target_audience: cleanText(input.target_audience, 1000),
      offer_price_range: cleanText(input.offer_price_range, 100),
      acquisition_channel: cleanText(input.acquisition_channel, 100),
      website_status: cleanText(input.website_status, 100),
      primary_goal: cleanText(input.primary_goal, 100),
      funnel_preference: cleanText(input.funnel_preference, 100),
      timeline: cleanText(input.timeline, 100),
      pages_required: cleanText(input.pages_required, 100),
      assets_status: cleanText(input.assets_status, 100),
      budget_readiness: cleanText(input.budget_readiness, 100),
      biggest_challenge: cleanText(input.biggest_challenge, 1500),
      needs_shop: Boolean(input.needs_shop),
      needs_custom_features: Boolean(input.needs_custom_features),
      content_ready: input.assets_status === "ready" || input.assets_status === "partial",
      fit_score: fit.score,
      fit_status: fit.status,
      routing_reason: fit.reason,
      attribution,
      privacy_consent_at: now,
      marketing_consent_at: input.marketing_consent ? now : null,
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    console.error("Fit-check submission insert failed:", submissionError?.message);
    return salesError("Ihre Anfrage konnte nicht abgeschlossen werden.", 500);
  }

  const consentRows = [{
    submission_id: submission.id,
    lead_id: lead.id,
    event_type: "privacy",
    document_version: ONLINE_FIRST_PACKAGE.privacyVersion,
    occurred_at: now,
  }];
  if (input.marketing_consent) {
    consentRows.push({
      submission_id: submission.id,
      lead_id: lead.id,
      event_type: "marketing",
      document_version: ONLINE_FIRST_PACKAGE.privacyVersion,
      occurred_at: now,
    });
  }
  await supabaseAdmin.from("consent_events").insert(consentRows);

  return NextResponse.json({
    success: true,
    submission_id: submission.id,
    status: fit.status,
    score: fit.score,
    reason: fit.reason,
  }, { status: 201 });
}
