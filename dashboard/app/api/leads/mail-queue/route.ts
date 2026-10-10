import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/leads/mail-queue?venture=blazed_outfitters&status=queued&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const status  = searchParams.get("status");
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);

  let query = supabaseAdmin
    .from("lead_mail_queue")
    .select("id,created_at,venture,lead_id,from_email,from_name,to_email,to_name,subject,body_text,is_ai_draft,status,queued_by,sent_at,error_message,retry_count")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (venture && venture !== "alle") query = query.eq("venture", venture);
  if (status  && status  !== "alle") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// DELETE /api/leads/mail-queue?id=<uuid>  — Queued-Eintrag zurückziehen
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("lead_mail_queue")
    .delete()
    .eq("id", id)
    .eq("status", "queued"); // Nur queued darf zurückgezogen werden

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
