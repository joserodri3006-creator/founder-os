import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("inventory_movements")
    .select(`*, variant:product_variants(option_values, sku)`)
    .eq("product_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const { data: product } = await supabaseAdmin
    .from("products").select("venture").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  const { error, data } = await supabaseAdmin
    .from("inventory_movements")
    .insert({
      venture: product.venture,
      product_id: id,
      variant_id: body.variant_id ?? null,
      type: body.type, // in | out | adjustment | return
      quantity: body.type === "out" ? -Math.abs(body.quantity) : Math.abs(body.quantity),
      reference_type: body.reference_type ?? "manual",
      reference_id: body.reference_id ?? null,
      note: body.note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
