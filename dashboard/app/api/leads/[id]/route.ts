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
  const [leadRes, tagsRes] = await Promise.all([
    supabaseAdmin.from("leads").select("*").eq("id", id).single(),
    supabaseAdmin.from("lead_tag_map").select("tag:lead_tags(id, name)").eq("lead_id", id),
  ]);
  if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 404 });
  return NextResponse.json({
    ...leadRes.data,
    tags: (tagsRes.data ?? []).map((r: any) => r.tag),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const rawBody = await req.json();
  const { tag_ids, ...body } = rawBody;

  if (tag_ids !== undefined) {
    await supabaseAdmin.from("lead_tag_map").delete().eq("lead_id", id);
    if (tag_ids.length) {
      await supabaseAdmin.from("lead_tag_map").insert(
        tag_ids.map((tid: string) => ({ lead_id: id, tag_id: tid }))
      );
    }
  }

  if (Object.keys(body).length === 0) return NextResponse.json({ success: true });

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
