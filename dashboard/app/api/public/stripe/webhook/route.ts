import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ONLINE_FIRST_PACKAGE } from "@/lib/public-sales";

interface StripeCheckoutSession {
  id: string;
  payment_intent?: string | null;
  payment_status?: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

async function signatureIsValid(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const values = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    })
  );
  const timestamp = values.t;
  const signature = values.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = toHex(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  ));
  return secureEqual(expected, signature);
}

function paymentStepsFrom(model: { steps?: unknown } | null) {
  const configured = Array.isArray(model?.steps) ? model.steps as Array<Record<string, unknown>> : [
    { step: 1, label: "Anzahlung", percentage: 50, trigger: "auftragserteilung", due_days: 0 },
    { step: 2, label: "Restzahlung", percentage: 50, trigger: "abnahme", due_days: 7 },
  ];

  return configured.map((step, index) => ({
    ...step,
    amount: Math.round(
      (Number(step.percentage ?? 0) / 100) * (ONLINE_FIRST_PACKAGE.netPriceCents / 100) * 100
    ) / 100,
    due_date: new Date(Date.now() + Number(step.due_days ?? 0) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    paid: index === 0,
    paid_at: index === 0 ? new Date().toISOString() : null,
  }));
}

async function fulfillPayment(session: StripeCheckoutSession) {
  const { data: checkout, error: checkoutError } = await supabaseAdmin
    .from("sales_checkout_sessions")
    .select("id,submission_id,lead_id,status,order_id")
    .eq("stripe_session_id", session.id)
    .single();
  if (checkoutError || !checkout) throw new Error("Checkout session not found");
  if (checkout.status === "paid" && checkout.order_id) return;

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("sales_submissions")
    .select("id,lead_id,first_name,last_name,email,company_name,website")
    .eq("id", checkout.submission_id)
    .single();
  if (submissionError || !submission) throw new Error("Sales submission not found");

  let { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("venture", "online_first")
    .eq("email", submission.email)
    .maybeSingle();

  if (!customer) {
    const { data: insertedCustomer, error } = await supabaseAdmin
      .from("customers")
      .insert({
        venture: "online_first",
        first_name: submission.first_name,
        last_name: submission.last_name,
        email: submission.email,
        company_name: submission.company_name,
        website: submission.website,
        customer_type: "b2b",
        status: "active",
      })
      .select("id")
      .single();
    if (error || !insertedCustomer) throw new Error("Customer creation failed");
    customer = insertedCustomer;
  }

  const { data: model } = await supabaseAdmin
    .from("payment_models")
    .select("id,steps")
    .eq("venture", "online_first")
    .eq("is_default", true)
    .maybeSingle();

  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  let orderId = existingOrder?.id;
  if (!orderId) {
    const briefingToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        venture: "online_first",
        customer_id: customer.id,
        lead_id: submission.lead_id,
        title: `Authority Website Sprint - ${submission.company_name || `${submission.first_name} ${submission.last_name}`}`,
        package_type: ONLINE_FIRST_PACKAGE.code,
        description: "Authority Website Sprint inklusive Kontakt- oder Termin-Funnel",
        value: ONLINE_FIRST_PACKAGE.netPriceCents / 100,
        status: "neu",
        payment_model_id: model?.id ?? null,
        payment_steps: paymentStepsFrom(model),
        anzahlung_betrag: ONLINE_FIRST_PACKAGE.depositNetCents / 100,
        anzahlung_erhalten: true,
        restzahlung_erhalten: false,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        checkout_source: "online_first_public_funnel",
        briefing_token: briefingToken,
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Order creation failed");
    orderId = order.id;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await supabaseAdmin
      .from("orders")
      .update({
        status: "briefing",
        briefing_url: `${siteUrl}/online-first/briefing?token=${briefingToken}`,
      })
      .eq("id", order.id);
  }

  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin
      .from("sales_checkout_sessions")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent ?? null,
        paid_at: now,
        order_id: orderId,
        updated_at: now,
      })
      .eq("id", checkout.id),
    supabaseAdmin
      .from("leads")
      .update({ status: "gewonnen", funnel_stage: "deposit_paid", customer_id: customer.id })
      .eq("id", submission.lead_id),
  ]);

  await supabaseAdmin.from("order_activities").insert({
    order_id: orderId,
    activity_type: "payment_received",
    description: "Stripe-Anzahlung aus dem Online-First-Checkout bestaetigt.",
  });
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!await signatureIsValid(payload, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
    && event.data.object.payment_status === "paid"
  ) {
    try {
      await fulfillPayment(event.data.object);
    } catch (error) {
      console.error("Stripe fulfillment failed:", error);
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
