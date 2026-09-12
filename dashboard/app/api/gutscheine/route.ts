import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const venture = req.nextUrl.searchParams.get("venture");
  const status  = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("vouchers")
    .select("*")
    .order("created_at", { ascending: false });

  if (venture) query = query.eq("venture", venture);
  if (status && status !== "alle") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, type, value, venture } = body;

  if (!code || !type || value == null || !venture) {
    return NextResponse.json(
      { error: "Pflichtfelder fehlen: code, type, value, venture" },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {
    code,
    type,
    value,
    venture,
    status: "active",
    uses_count: 0,
    currency: body.currency ?? "EUR",
  };

  if (type === "gift_card") {
    payload.remaining_value = value;
  }
  if (body.min_order_value != null) payload.min_order_value = body.min_order_value;
  if (body.max_uses != null) payload.max_uses = body.max_uses;
  if (body.single_use != null) payload.single_use = body.single_use;
  if (body.valid_until) payload.valid_until = body.valid_until;
  if (body.customer_email) payload.customer_email = body.customer_email;
  if (body.notes) payload.notes = body.notes;

  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
