import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("product_supplier_map")
    .select("*, supplier:suppliers(*)")
    .eq("product_id", id)
    .order("is_primary", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { supplier_id, purchase_price, lead_time_days, is_primary, notes } = body;

  // If setting as primary, clear existing primary
  if (is_primary) {
    await supabaseAdmin
      .from("product_supplier_map")
      .update({ is_primary: false })
      .eq("product_id", id);
  }

  const { error } = await supabaseAdmin.from("product_supplier_map").upsert({
    product_id: id,
    supplier_id,
    purchase_price: purchase_price ?? null,
    lead_time_days: lead_time_days ?? null,
    is_primary: is_primary ?? false,
    notes: notes ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supplier_id } = await req.json();
  const { error } = await supabaseAdmin
    .from("product_supplier_map")
    .delete()
    .eq("product_id", id)
    .eq("supplier_id", supplier_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
