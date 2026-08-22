import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { data: original, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Aufgabe nicht gefunden" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at, updated_at, completed_at, status, title, created_by, sort_order, ...rest } = original;

  const { data: maxRow } = await supabaseAdmin
    .from("tasks")
    .select("sort_order")
    .eq("venture", original.venture)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("tasks")
    .insert({ ...rest, title: `${title} (Kopie)`, status: "open", sort_order: nextSortOrder })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ success: true, id: inserted.id });
}
