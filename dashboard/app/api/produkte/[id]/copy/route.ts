import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const newName: string = body.name;

  const { data: original, error: fetchErr } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !original) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, slug: _sl, ...fields } = original;

  // Generate unique slug from new name
  const slug = newName
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now();

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("products")
    .insert({ ...fields, name: newName, slug, status: "draft", images: [] })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ success: true, id: inserted.id });
}
