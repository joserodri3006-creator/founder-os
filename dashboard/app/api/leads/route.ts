import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const venture = searchParams.get("venture");
  const showArchived = searchParams.get("archived") === "true";

  let query = supabaseAdmin
    .from("leads")
    .select("id,first_name,last_name,email,company_name,status,source,city,industry,follow_up_date,ai_draft_approved,archived_at,created_at,venture,is_duplicate")
    .order("created_at", { ascending: false });

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (status && status !== "alle") query = query.eq("status", status);
  if (source && source !== "alle") query = query.eq("source", source);
  if (venture && venture !== "alle") query = query.eq("venture", venture);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id und status erforderlich" }, { status: 400 });

  const { error } = await supabaseAdmin.from("leads").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
