import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const venture = url.searchParams.get("venture");
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = supabaseAdmin
    .from("product_sync_log")
    .select(`
      id, product_id, venture, action, status, wc_product_id,
      error_message, created_at, completed_at,
      product:products(id, name, slug)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (venture) query = query.eq("venture", venture);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [], total: count });
}

// Manual trigger: POST with { product_id } to re-sync a product
export async function POST(req: NextRequest) {
  const { product_id } = await req.json();
  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  // Set sync_status = 'pending' to trigger the webhook
  const { error } = await supabaseAdmin
    .from("products")
    .update({ sync_status: "pending" })
    .eq("id", product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ queued: true });
}
