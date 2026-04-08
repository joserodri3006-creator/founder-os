import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { venture } = await req.json();

  const { data: original, error: fetchErr } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !original) {
    return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, archived_at: _aa, ...fields } = original;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("customers")
    .insert({ ...fields, venture, archived_at: null })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ success: true, id: inserted.id });
}
