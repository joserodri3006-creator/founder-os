import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/finanzen/[id] — Buchung (Stammdaten) aktualisieren.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { shares, ...fields } = body;

  const { data, error } = await supabaseAdmin
    .from("finance_entries")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(shares)) {
    await supabaseAdmin.from("finance_entry_shares").delete().eq("entry_id", id);
    if (shares.length > 0) {
      await supabaseAdmin.from("finance_entry_shares").insert(
        shares.map((s: any) => ({
          entry_id: id,
          partner_name: s.partner_name,
          partner_user_id: s.partner_user_id || null,
          share_amount: s.share_amount,
          paid_amount: s.paid_amount || 0,
          paid_date: s.paid_date || null,
          notes: s.notes || null,
        }))
      );
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/finanzen/[id] — Buchung inkl. aller Vorkommen und Anteile löschen (Cascade).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("finance_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
