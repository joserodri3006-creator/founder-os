import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { activeVariantStocks } from "@/lib/product-stock";

// Google-artige Volltextsuche über alle relevanten Freitext-/Identifikationsfelder
// eines Produkts (nicht nur den Namen) — spiegelt das Suchmuster aus /api/leads.
const SEARCH_COLUMNS = [
  "name", "sku", "internal_number", "short_description", "description", "notes",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const status = searchParams.get("status");
  const type_id = searchParams.get("type_id");
  const category_id = searchParams.get("category_id");
  const search = searchParams.get("search")?.trim();
  const paginated = searchParams.has("page") || searchParams.has("page_size");
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("page_size") ?? "50", 10) || 50));

  // Resolve category IDs before the main query so filtering happens in Postgres,
  // rather than loading every product and filtering a large response in Node.
  let categoryProductIds: string[] | null = null;
  if (category_id) {
    const { data: map, error: mapError } = await supabaseAdmin
      .from("product_category_map")
      .select("product_id")
      .eq("category_id", category_id);
    if (mapError) return NextResponse.json({ error: mapError.message }, { status: 500 });
    categoryProductIds = (map ?? []).map((row: any) => row.product_id);
    if (categoryProductIds.length === 0) return NextResponse.json(paginated ? { data: [], total: 0, page, pageSize } : []);
  }

  let query = supabaseAdmin
    .from("products")
    .select(`
      id, name, slug, sku, price, compare_at_price, status, is_featured,
      source_type, affiliate_network, affiliate_merchant, affiliate_url,
      affiliate_commission_rate, affiliate_commission_type, affiliate_status,
      sync_status, last_synced_at, wc_product_id, channel,
      track_inventory, venture, created_at, updated_at, images,
      product_variants(stock_quantity, is_active),
      product_type:product_types(id, name, has_variants, has_inventory),
      brand:product_brands(id, name)
    `, { count: paginated ? "exact" : undefined })
    .order("created_at", { ascending: false });

  if (venture) query = query.eq("venture", venture);
  if (status) query = query.eq("status", status);
  if (searchParams.get("source_type")) query = query.eq("source_type", searchParams.get("source_type"));
  if (type_id) query = query.eq("product_type_id", type_id);
  if (categoryProductIds) query = query.in("id", categoryProductIds);
  if (search) {
    const term = search.replace(/[%,]/g, "");
    query = query.or(SEARCH_COLUMNS.map((col) => `${col}.ilike.%${term}%`).join(","));
  }
  if (paginated) query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((product: any) => ({
    ...product,
    product_variants: activeVariantStocks(product.product_variants),
  }));

  // Keep the legacy array response for callers that request the full list
  // (e.g. product selectors), while the list page uses the paginated shape.
  return NextResponse.json(paginated ? { data: products, total: count ?? 0, page, pageSize } : products);
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
