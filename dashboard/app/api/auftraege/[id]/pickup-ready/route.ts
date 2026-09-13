import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

/**
 * Proxied Aufruf an Itaba: markiert eine B2C-Abholbestellung als
 * abholbereit und benachrichtigt den Kunden per E-Mail. Das Secret
 * (B2B_ORDER_CONFIRM_SECRET) verlässt niemals den Server.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const siteUrl = process.env.ITABA_SITE_URL;
  const secret = process.env.B2B_ORDER_CONFIRM_SECRET;
  if (!siteUrl || !secret) {
    return NextResponse.json({ error: "ITABA_SITE_URL oder B2B_ORDER_CONFIRM_SECRET fehlt" }, { status: 500 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, venture, channel")
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (order.venture !== "itaba" || order.channel !== "b2c") {
    return NextResponse.json({ error: "Nur für Itaba-B2C-Bestellungen verfügbar" }, { status: 400 });
  }

  const res = await fetch(`${siteUrl}/api/bestellung/${id}/pickup-ready`, {
    method: "POST",
    headers: { "x-internal-secret": secret, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) return NextResponse.json({ error: data.error ?? "Anfrage an Itaba fehlgeschlagen" }, { status: res.status });

  return NextResponse.json(data);
}
