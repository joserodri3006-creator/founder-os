import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const archived = searchParams.get("archived") === "true";

  let query = supabaseAdmin
    .from("customers")
    .select("id,first_name,last_name,company_name,email,phone,city,venture,created_at,archived_at")
    .order("created_at", { ascending: false });

  if (venture && venture !== "alle") query = query.eq("venture", venture);
  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
