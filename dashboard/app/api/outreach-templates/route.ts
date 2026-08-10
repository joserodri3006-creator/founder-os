import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const venture = req.nextUrl.searchParams.get("venture");
  let query = supabaseAdmin.from("outreach_templates").select("*").order("name");
  if (venture) query = query.eq("venture", venture);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { venture, name, subject, body: text } = body;
  if (!venture || !name?.trim() || !subject?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "venture, name, subject und body erforderlich" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("outreach_templates")
    .insert({ venture, name, subject, body: text })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
