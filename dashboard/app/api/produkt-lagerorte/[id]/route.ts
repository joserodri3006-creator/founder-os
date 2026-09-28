import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["name", "parent_id", "sort_order", "note"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  const { data, error } = await supabaseAdmin
    .from("product_locations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  // Lagerorte mit Unterorten dürfen nicht gelöscht werden (analog Kategorien)
  const { count } = await supabaseAdmin
    .from("product_locations")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Lagerort hat Unterorte. Bitte zuerst die Unterorte löschen." },
      { status: 400 }
    );
  }
  const { error } = await supabaseAdmin.from("product_locations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
