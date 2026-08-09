import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("*, product:products(id, name, sku)")
    .eq("order_id", id)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { product_id, product_name, sku, quantity, unit_price, notes } = body;

  const { data, error } = await supabaseAdmin.from("order_items").insert({
    order_id: id,
    product_id: product_id || null,
    product_name,
    sku: sku || null,
    quantity: quantity ?? 1,
    unit_price: unit_price ?? 0,
    notes: notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { item_id } = await req.json();
  const { error } = await supabaseAdmin
    .from("order_items")
    .delete()
    .eq("id", item_id)
    .eq("order_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
