import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const [productRes, categoriesRes, tagsRes, variantOptionsRes, variantsRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select(`*, product_type:product_types(*), brand:product_brands(*)`)
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("product_category_map")
      .select("category:product_categories(id, name, parent_id)")
      .eq("product_id", id),
    supabaseAdmin
      .from("product_tag_map")
      .select("tag:product_tags(id, name)")
      .eq("product_id", id),
    supabaseAdmin
      .from("product_variant_options")
      .select("*")
      .eq("product_id", id)
      .order("sort_order"),
    supabaseAdmin
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("created_at"),
  ]);

  if (productRes.error || !productRes.data)
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json({
    ...productRes.data,
    categories: (categoriesRes.data ?? []).map((r: any) => r.category),
    tags: (tagsRes.data ?? []).map((r: any) => r.tag),
    variant_options: variantOptionsRes.data ?? [],
    variants: variantsRes.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { category_ids, tag_ids, ...fields } = body;

  if (Object.keys(fields).length > 0) {
    const { error } = await supabaseAdmin.from("products").update(fields).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync categories
  if (category_ids !== undefined) {
    await supabaseAdmin.from("product_category_map").delete().eq("product_id", id);
    if (category_ids.length) {
      await supabaseAdmin.from("product_category_map").insert(
        category_ids.map((cid: string) => ({ product_id: id, category_id: cid }))
      );
    }
  }

  // Sync tags
  if (tag_ids !== undefined) {
    await supabaseAdmin.from("product_tag_map").delete().eq("product_id", id);
    if (tag_ids.length) {
      await supabaseAdmin.from("product_tag_map").insert(
        tag_ids.map((tid: string) => ({ product_id: id, tag_id: tid }))
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Delete storage images
  const { data: product } = await supabaseAdmin
    .from("products").select("images").eq("id", id).single();

  if (product?.images?.length) {
    const paths = product.images
      .filter((img: any) => img.storage_path)
      .map((img: any) => img.storage_path);
    if (paths.length) {
      await supabaseAdmin.storage.from("product-images").remove(paths);
    }
  }

  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
