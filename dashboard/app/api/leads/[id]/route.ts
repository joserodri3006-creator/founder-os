import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

const REVIEW_COLUMNS = [
  "review_status",
  "lead_potential",
  "contact_channel",
  "next_action",
  "review_notes",
  "reviewed_at",
];

function isMissingReviewColumnError(message: string | undefined) {
  return Boolean(message && REVIEW_COLUMNS.some((column) => message.includes(column)));
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  let { error } = await supabaseAdmin.from("leads").update(body).eq("id", id);
  if (isMissingReviewColumnError(error?.message)) {
    const {
      review_status,
      lead_potential,
      contact_channel,
      next_action,
      review_notes,
      reviewed_at,
      ...fallbackBody
    } = body;
    void review_status;
    void lead_potential;
    void contact_channel;
    void next_action;
    void review_notes;
    void reviewed_at;
    const fallback = await supabaseAdmin.from("leads").update(fallbackBody).eq("id", id);
    error = fallback.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
