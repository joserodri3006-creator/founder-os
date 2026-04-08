import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*, orders:orders(id, title, value, status, invoice_number, created_at)")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'city', 'street', 'postal_code', 'country', 'notes', 'venture'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];
  const { data, error } = await supabaseAdmin
    .from("customers").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  return PATCH(req, { params });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("customers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
