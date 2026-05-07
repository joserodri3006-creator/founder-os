import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

// GET — alle Rabatte für diesen Kunden
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const [{ data: catDiscounts }, { data: prodDiscounts }] = await Promise.all([
    supabaseAdmin
      .from("b2b_category_discounts")
      .select("id, discount_rate, category_id, product_categories(id, name, path, level)")
      .eq("customer_id", id),

    supabaseAdmin
      .from("b2b_product_discounts")
      .select("id, discount_rate, product_id, products(id, name, sku)")
      .eq("customer_id", id),
  ]);

  return NextResponse.json({
    category_discounts: catDiscounts ?? [],
    product_discounts:  prodDiscounts ?? [],
  });
}

// POST — Rabatt anlegen/aktualisieren
// Body: { type: "category"|"product", ref_id: uuid, discount_rate: number, venture: string }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { type, ref_id, discount_rate, venture } = await req.json();

  if (!type || !ref_id || discount_rate == null) {
    return NextResponse.json({ error: "type, ref_id, discount_rate required" }, { status: 400 });
  }

  if (type === "category") {
    const { data, error } = await supabaseAdmin
      .from("b2b_category_discounts")
      .upsert(
        { customer_id: id, category_id: ref_id, discount_rate, venture: venture ?? "" },
        { onConflict: "customer_id,category_id" }
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (type === "product") {
    const { data, error } = await supabaseAdmin
      .from("b2b_product_discounts")
      .upsert(
        { customer_id: id, product_id: ref_id, discount_rate, venture: venture ?? "" },
        { onConflict: "customer_id,product_id" }
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "type must be category or product" }, { status: 400 });
}

// DELETE — Rabatt entfernen
// Body: { type: "category"|"product", discount_id: uuid }
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { type, discount_id } = await req.json();

  if (type === "category") {
    const { error } = await supabaseAdmin
      .from("b2b_category_discounts")
      .delete()
      .eq("id", discount_id)
      .eq("customer_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from("b2b_product_discounts")
      .delete()
      .eq("id", discount_id)
      .eq("customer_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
