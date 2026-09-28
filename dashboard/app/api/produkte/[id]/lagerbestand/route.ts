import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

// GET: Bestand je Variante UND Lagerort (product_locations) für dieses Produkt.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { data: variants, error: variantsError } = await supabaseAdmin
    .from("product_variants")
    .select("id, sku, option_values, stock_quantity")
    .eq("product_id", id)
    .eq("is_active", true);
  if (variantsError) return NextResponse.json({ error: variantsError.message }, { status: 500 });

  const variantIds = (variants ?? []).map(v => v.id);
  if (variantIds.length === 0) return NextResponse.json({ variants: [] });

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("variant_stock_locations")
    .select("variant_id, location_id, quantity, location:product_locations(id, name, parent_id)")
    .in("variant_id", variantIds);
  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 });

  const byVariant = (variants ?? []).map(v => ({
    ...v,
    locations: (rows ?? []).filter(r => r.variant_id === v.id),
  }));

  return NextResponse.json({ variants: byVariant });
}

// POST: Wareneingang/-ausgang/Korrektur an einem Ort ODER Umbuchung
// zwischen zwei Orten — ruft die in Supabase hinterlegten RPCs auf
// (record_stock_movement / transfer_stock), die den Lagerbestand je Ort
// UND die Gesamtsumme (product_variants.stock_quantity) konsistent halten.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const { data: product } = await supabaseAdmin
    .from("products").select("venture").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  if (body.action === "transfer") {
    const { variant_id, from_location_id, to_location_id, quantity, note } = body;
    if (!variant_id || !from_location_id || !to_location_id || !quantity) {
      return NextResponse.json({ error: "variant_id, from_location_id, to_location_id, quantity erforderlich" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.rpc("transfer_stock", {
      p_venture: product.venture,
      p_variant_id: variant_id,
      p_from_location_id: from_location_id,
      p_to_location_id: to_location_id,
      p_quantity: quantity,
      p_note: note ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ transfer_id: data }, { status: 201 });
  }

  const { variant_id, location_id, delta, type, note } = body;
  if (!variant_id || !location_id || !delta) {
    return NextResponse.json({ error: "variant_id, location_id, delta erforderlich" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.rpc("record_stock_movement", {
    p_venture: product.venture,
    p_variant_id: variant_id,
    p_location_id: location_id,
    p_delta: delta,
    p_type: type ?? "correction",
    p_note: note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
}
