import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = ["title", "description", "status", "priority", "due_date", "assigned_to"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) if (key in body) updates[key] = body[key];

  if ("status" in updates) {
    updates.completed_at = updates.status === "done" ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
