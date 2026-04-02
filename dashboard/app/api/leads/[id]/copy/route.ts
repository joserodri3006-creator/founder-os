import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { venture } = await req.json();

  if (!venture) return NextResponse.json({ error: "venture fehlt" }, { status: 400 });

  const { data: lead, error: fetchError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  // Duplikat-Check für das Ziel-Venture
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("email", lead.email)
    .eq("venture", venture)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "duplicate", message: `Lead existiert bereits in ${venture}` }, { status: 409 });
  }

  const { id: _id, created_at, updated_at, won_at, lost_at, archived_at,
    ai_draft_subject, ai_draft_body, ai_draft_created_at, ai_draft_approved,
    last_contacted_at, follow_up_date, reactivation_date, customer_id,
    is_duplicate, duplicate_of, ...rest } = lead;

  const { data: copy, error: insertError } = await supabaseAdmin
    .from("leads")
    .insert({ ...rest, venture, status: "neu", automation_enabled: true })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ success: true, id: copy.id });
}
