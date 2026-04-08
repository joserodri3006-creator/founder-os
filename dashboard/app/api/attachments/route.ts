import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entity_type = searchParams.get("entity_type");
  const entity_id = searchParams.get("entity_id");
  if (!entity_type || !entity_id) return NextResponse.json([], { status: 200 });
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("*")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const entity_type = formData.get("entity_type") as string;
  const entity_id = formData.get("entity_id") as string;
  const description = formData.get("description") as string | null;
  const venture = formData.get("venture") as string | null;

  if (!file || !entity_type || !entity_id) {
    return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
  }

  const storage_path = `${entity_type}/${entity_id}/${Date.now()}-${file.name}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("attachments")
    .upload(storage_path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin.from("attachments").insert({
    entity_type,
    entity_id,
    filename: file.name,
    storage_path,
    description: description || null,
    size_bytes: file.size,
    mime_type: file.type,
    venture: venture || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
