import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { venture } = await req.json();

  const { data: original, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !original) {
    return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, archived_at: _aa, invoice_number: _in,
    invoice_generated_at: _iga, invoice_html: _ih, invoice_sent: _is,
    anzahlung_erhalten: _az, restzahlung_erhalten: _rz, ...fields } = original;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("orders")
    .insert({
      ...fields,
      venture,
      status: "neu",
      archived_at: null,
      invoice_number: null,
      invoice_generated_at: null,
      invoice_html: null,
      invoice_sent: false,
      anzahlung_erhalten: false,
      restzahlung_erhalten: false,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ success: true, id: inserted.id });
}
