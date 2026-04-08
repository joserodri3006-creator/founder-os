import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data: att } = await supabaseAdmin.from("attachments").select("*").eq("id", id).single();
  if (!att) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const { data } = await supabaseAdmin.storage.from("attachments").createSignedUrl(att.storage_path, 3600);
  return NextResponse.json({ url: data?.signedUrl, filename: att.filename });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data: att } = await supabaseAdmin.from("attachments").select("*").eq("id", id).single();
  if (!att) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  await supabaseAdmin.storage.from("attachments").remove([att.storage_path]);
  await supabaseAdmin.from("attachments").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
