import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const [customerRes, tagsRes] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("*, orders:orders(id, title, value, status, invoice_number, created_at)")
      .eq("id", id)
      .single(),
    supabaseAdmin.from("customer_tag_map").select("tag:customer_tags(id, name)").eq("customer_id", id),
  ]);
  if (customerRes.error || !customerRes.data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json({
    ...customerRes.data,
    tags: (tagsRes.data ?? []).map((r: any) => r.tag),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'city', 'street', 'postal_code', 'country', 'notes', 'venture', 'customer_type', 'status', 'discount_rate'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) updates[key] = body[key];

  if (body.tag_ids !== undefined) {
    await supabaseAdmin.from("customer_tag_map").delete().eq("customer_id", id);
    if (body.tag_ids.length) {
      await supabaseAdmin.from("customer_tag_map").insert(
        body.tag_ids.map((tid: string) => ({ customer_id: id, tag_id: tid }))
      );
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });

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
