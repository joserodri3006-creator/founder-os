import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");

  let query = supabaseAdmin
    .from("leads")
    .select("id,first_name,last_name,email,company_name,industry,notes,ai_draft_subject,ai_draft_body,ai_draft_approved,created_at,venture")
    .eq("ai_draft_approved", false)
    .not("ai_draft_subject", "is", null)
    .order("created_at", { ascending: false });

  if (venture && venture !== "alle") query = query.eq("venture", venture);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
