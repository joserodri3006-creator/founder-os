import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const status = searchParams.get("status");
  const type_id = searchParams.get("type_id");
  const category_id = searchParams.get("category_id");
  const search = searchParams.get("search");

  let query = supabaseAdmin
    .from("products")
    .select(`
      id, name, slug, sku, price, compare_at_price, status, is_featured,
      sync_status, last_synced_at, wc_product_id,
      track_inventory, venture, created_at, updated_at, images,
      product_type:product_types(id, name, has_variants, has_inventory),
      brand:product_brands(id, name)
    `)
    .order("created_at", { ascending: false });

  if (venture) query = query.eq("venture", venture);
  if (status) query = query.eq("status", status);
  if (type_id) query = query.eq("product_type_id", type_id);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by category via junction table
  if (category_id && data) {
    const { data: map } = await supabaseAdmin
      .from("product_category_map")
      .select("product_id")
      .eq("category_id", category_id);
    const ids = new Set((map ?? []).map((r: any) => r.product_id));
    return NextResponse.json(data.filter((p: any) => ids.has(p.id)));
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { category_ids, tag_ids, ...fields } = body;

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert(fields)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert category relations
  if (category_ids?.length) {
    await supabaseAdmin.from("product_category_map").insert(
      category_ids.map((cid: string) => ({ product_id: data.id, category_id: cid }))
    );
  }

  // Insert tag relations
  if (tag_ids?.length) {
    await supabaseAdmin.from("product_tag_map").insert(
      tag_ids.map((tid: string) => ({ product_id: data.id, tag_id: tid }))
    );
  }

  return NextResponse.json(data, { status: 201 });
}
