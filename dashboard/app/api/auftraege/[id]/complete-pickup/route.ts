import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const siteUrl = process.env.ITABA_SITE_URL;
  const secret = process.env.B2B_ORDER_CONFIRM_SECRET;
  if (!siteUrl || !secret) return NextResponse.json({ error: "ITABA-Zugang nicht konfiguriert" }, { status: 500 });

  const { data: order, error } = await supabaseAdmin
    .from("orders").select("id, venture, channel, status, invoice_data, payment_status")
    .eq("id", id).single();
  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (order.venture !== "itaba" || order.channel !== "b2c" || order.invoice_data?.delivery_method !== "abholung") {
    return NextResponse.json({ error: "Nur für Itaba-B2C-Abholreservierungen verfügbar" }, { status: 400 });
  }
  if (order.payment_status === "bezahlt") return NextResponse.json({ success: true, already_paid: true });

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${siteUrl}/api/bestellung/${id}/complete-pickup`, {
    method: "POST",
    headers: { "x-internal-secret": secret, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error ?? "Abschluss bei Itaba fehlgeschlagen" }, { status: res.status });
  if (res.ok) {
    await supabaseAdmin.from("order_activities").insert({
      order_id: id,
      activity_type: "pickup_completed_offline",
      description: `Vor-Ort-Kauf offline an der Kasse zugeordnet (${body?.offline_payment_method ?? "sonstige"}${body?.offline_payment_reference ? `, Beleg ${body.offline_payment_reference}` : ""}). Keine Online-Rechnung erzeugt.`,
    });
  }
  return NextResponse.json(data);
}
