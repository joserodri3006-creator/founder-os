import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/finanzen/vorkommen/[id] — ein konkretes Monats-Vorkommen als
// bezahlt/offen/storniert markieren (unabhängig von den übrigen Vorkommen
// derselben wiederkehrenden Buchung).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, paid_date } = body;

  if (!["offen", "bezahlt", "storniert"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("finance_entry_occurrences")
    .update({ status, paid_date: status === "bezahlt" ? (paid_date || new Date().toISOString().slice(0, 10)) : null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
