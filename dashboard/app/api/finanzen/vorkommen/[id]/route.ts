import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/finanzen/vorkommen/[id] — ein konkretes Monats-Vorkommen als
// bezahlt/offen/storniert markieren und/oder den Lexware-Erfassungsstatus
// setzen (unabhängig von den übrigen Vorkommen derselben wiederkehrenden
// Buchung, und unabhängig vom Zahlstatus — eine Buchung kann bezahlt, aber
// noch nicht in Lexware erfasst sein, oder umgekehrt).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, paid_date, lexware_erfasst } = body;

  const update: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!["offen", "bezahlt", "storniert"].includes(status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }
    update.status = status;
    update.paid_date = status === "bezahlt" ? (paid_date || new Date().toISOString().slice(0, 10)) : null;
  }

  if (lexware_erfasst !== undefined) {
    update.lexware_erfasst = Boolean(lexware_erfasst);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nichts zu aktualisieren" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("finance_entry_occurrences")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
