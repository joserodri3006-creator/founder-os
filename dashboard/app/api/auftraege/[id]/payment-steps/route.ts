import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

// PATCH: toggle paid status of a single step
// Body: { step: number, paid: boolean }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { step, paid } = await req.json();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("payment_steps, value")
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const steps: any[] = Array.isArray(order.payment_steps) ? order.payment_steps : [];
  const updated = steps.map((s) =>
    s.step === step
      ? { ...s, paid, paid_at: paid ? new Date().toISOString() : null }
      : s
  );

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ payment_steps: updated })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Log activity
  const stepData = updated.find((s) => s.step === step);
  const amount = stepData?.amount != null
    ? ` (${stepData.amount.toLocaleString("de-DE")} €)`
    : "";
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "note",
    description: `${stepData?.label ?? `Schritt ${step}`}${amount} als ${paid ? "bezahlt" : "offen"} markiert`,
  });

  return NextResponse.json({ success: true, payment_steps: updated });
}

// POST: apply a payment model to this order (recalculates steps)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { model_id } = await req.json();

  const [orderRes, modelRes] = await Promise.all([
    supabaseAdmin.from("orders").select("value, created_at").eq("id", id).single(),
    supabaseAdmin.from("payment_models").select("*").eq("id", model_id).single(),
  ]);

  if (orderRes.error || !orderRes.data) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (modelRes.error || !modelRes.data) return NextResponse.json({ error: "Zahlungsmodell nicht gefunden" }, { status: 404 });

  const order = orderRes.data;
  const model = modelRes.data;
  const totalValue = order.value ?? 0;
  const createdAt = new Date(order.created_at);

  const steps = (model.steps as any[]).map((s) => {
    const amount = Math.round((s.percentage / 100) * totalValue * 100) / 100;
    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + (s.due_days ?? 0));
    return {
      ...s,
      amount,
      due_date: dueDate.toISOString().split("T")[0],
      paid: false,
      paid_at: null,
    };
  });

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ payment_model_id: model_id, payment_steps: steps })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "note",
    description: `Zahlungsmodell "${model.name}" zugewiesen`,
  });

  return NextResponse.json({ success: true, payment_steps: steps });
}
