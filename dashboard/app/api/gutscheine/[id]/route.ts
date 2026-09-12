import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const [voucherRes, redemptionsRes] = await Promise.all([
    supabaseAdmin.from("vouchers").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("voucher_redemptions")
      .select("*")
      .eq("voucher_id", id)
      .order("redeemed_at", { ascending: false }),
  ]);

  if (voucherRes.error)
    return NextResponse.json({ error: voucherRes.error.message }, { status: 404 });

  return NextResponse.json({
    ...voucherRes.data,
    redemptions: redemptionsRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();

  const allowed = ["status", "notes", "valid_until", "max_uses"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Keine gültigen Felder zum Aktualisieren" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
