import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { subject, body, is_ai_draft } = await req.json();

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "subject und body erforderlich" }, { status: 400 });
  }

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("first_name, last_name, email, venture, status")
    .eq("id", id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: "Lead hat keine E-Mail-Adresse" }, { status: 400 });

  const sender = getSender(lead.venture);
  const toName = `${lead.first_name} ${lead.last_name}`.trim();

  const { data: entry, error: insertErr } = await supabaseAdmin
    .from("lead_mail_queue")
    .insert({
      venture:    lead.venture,
      lead_id:    id,
      from_email: sender.email,
      from_name:  sender.name,
      to_email:   lead.email,
      to_name:    toName || null,
      subject,
      body_text:  body,
      is_ai_draft: Boolean(is_ai_draft),
      status:     "queued",
      queued_by:  "dashboard",
    })
    .select("id, status, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: "Queue-Eintrag konnte nicht erstellt werden", detail: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, queue_id: entry.id, status: "queued" });
}
