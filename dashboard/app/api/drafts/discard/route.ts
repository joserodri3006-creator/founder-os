import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json();
  if (!lead_id) return NextResponse.json({ error: "lead_id fehlt" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ ai_draft_approved: null, ai_draft_subject: null, ai_draft_body: null })
    .eq("id", lead_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
