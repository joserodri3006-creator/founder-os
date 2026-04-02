import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("system_config")
    .select("key, value, description")
    .order("key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: "key erforderlich" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("system_config")
    .upsert({ key, value: String(value) }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
