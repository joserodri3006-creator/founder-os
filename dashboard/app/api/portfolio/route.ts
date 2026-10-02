import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const venture = searchParams.get("venture");
  const area = searchParams.get("area");
  const relevance = searchParams.get("relevance");
  const includeArchived = searchParams.get("include_archived") === "true";
  const search = searchParams.get("search");

  let query = supabaseAdmin
    .from("portfolio_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!includeArchived) query = query.eq("is_archived", false);
  if (status) query = query.eq("status", status);
  if (venture) query = query.eq("venture", venture);
  if (area) query = query.eq("area", area);
  if (relevance) query = query.eq("portfolio_relevance", relevance);
  if (search) query = query.or(`name.ilike.%${search}%,area.ilike.%${search}%,tech_stack.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
