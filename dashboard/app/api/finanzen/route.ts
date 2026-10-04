import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateOccurrences } from "@/lib/finance-occurrences";

// GET /api/finanzen?venture=...&from=YYYY-MM-DD&to=YYYY-MM-DD
// Liefert Buchungen inkl. ihrer Vorkommen im angefragten Zeitraum + Partneranteile.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!venture) return NextResponse.json({ error: "venture fehlt" }, { status: 400 });

  const { data: entries, error } = await supabaseAdmin
    .from("finance_entries")
    .select(`
      id, venture, type, description, category, account, amount, currency,
      status, entry_date, paid_date, is_recurring, recurrence_interval,
      recurrence_end_date, order_id, notes, created_at,
      finance_entry_occurrences(id, occurrence_date, amount, status, paid_date),
      finance_entry_shares(id, occurrence_id, partner_name, partner_user_id, share_amount, paid_amount, paid_date, notes)
    `)
    .eq("venture", venture)
    .order("entry_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let result = entries ?? [];

  // Zeitraum-Filter wirkt auf die Vorkommen, nicht auf die Buchung selbst —
  // eine wiederkehrende Buchung bleibt sichtbar, auch wenn nur eines ihrer
  // Vorkommen in den Zeitraum fällt.
  if (from || to) {
    result = result
      .map((e: any) => ({
        ...e,
        finance_entry_occurrences: (e.finance_entry_occurrences ?? []).filter((o: any) => {
          if (from && o.occurrence_date < from) return false;
          if (to && o.occurrence_date > to) return false;
          return true;
        }),
      }))
      .filter((e: any) => e.finance_entry_occurrences.length > 0);
  }

  return NextResponse.json(result);
}

// POST /api/finanzen — legt eine neue Buchung an und generiert ihre Vorkommen.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shares, ...fields } = body;

  if (!fields.venture || !fields.type || !fields.description || !fields.amount || !fields.entry_date) {
    return NextResponse.json({ error: "Pflichtfelder fehlen (venture, type, description, amount, entry_date)" }, { status: 400 });
  }

  const { data: entry, error } = await supabaseAdmin
    .from("finance_entries")
    .insert(fields)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const occurrenceDates = generateOccurrences(entry);
  const occurrenceRows = occurrenceDates.map((date: string) => ({
    entry_id: entry.id,
    occurrence_date: date,
    amount: entry.amount,
    status: date === entry.entry_date ? entry.status : "offen",
    paid_date: date === entry.entry_date ? entry.paid_date : null,
  }));

  const { data: occurrences, error: occError } = await supabaseAdmin
    .from("finance_entry_occurrences")
    .insert(occurrenceRows)
    .select();

  if (occError) return NextResponse.json({ error: occError.message }, { status: 500 });

  if (Array.isArray(shares) && shares.length > 0) {
    await supabaseAdmin.from("finance_entry_shares").insert(
      shares.map((s: any) => ({
        entry_id: entry.id,
        partner_name: s.partner_name,
        partner_user_id: s.partner_user_id || null,
        share_amount: s.share_amount,
        paid_amount: s.paid_amount || 0,
        paid_date: s.paid_date || null,
        notes: s.notes || null,
      }))
    );
  }

  return NextResponse.json({ ...entry, finance_entry_occurrences: occurrences }, { status: 201 });
}
