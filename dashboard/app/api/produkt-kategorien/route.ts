import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const venture = new URL(req.url).searchParams.get("venture");
  let query = supabaseAdmin
    .from("product_categories")
    .select("id, name, slug, parent_id, sort_order, level, path, description, image_url, meta_title, meta_description, venture")
    .order("level")
    .order("sort_order");
  if (venture) query = query.eq("venture", venture);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // slug + level + path are auto-set by DB trigger
  const { data, error } = await supabaseAdmin
    .from("product_categories")
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
