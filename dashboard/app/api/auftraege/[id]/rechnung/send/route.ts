import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first: { name: "Online First", email: "info@onlinefirst.eu" },
  brandary: { name: "Brandary Print Studio", email: "info@brandary.de" },
  droplane: { name: "Droplane", email: "info@droplane.de" },
  blazed_outfitters: { name: "Blazed Outfitters", email: "info@blazedoutfitters.com" },
  worknest: { name: "Worknest", email: "info@worknest.de" },
};

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  // Load order with customer
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(id, first_name, last_name, company_name, email)`)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (!order.invoice_html) return NextResponse.json({ error: "Bitte zuerst Rechnung generieren" }, { status: 400 });

  const customer = order.customer;
  if (!customer?.email) return NextResponse.json({ error: "Kunde hat keine E-Mail-Adresse" }, { status: 400 });

  const sender = VENTURE_SENDERS[order.venture] ?? VENTURE_SENDERS.online_first;
  const invoiceNumber = order.invoice_number ?? id;

  const subject = `Ihre Rechnung ${invoiceNumber} — ${order.title}`;
  const text = `Sehr geehrte/r ${customer.first_name} ${customer.last_name},

vielen Dank für Ihren Auftrag "${order.title}".

Im Anhang finden Sie Ihre Rechnung mit der Nummer ${invoiceNumber}.

Bitte überweisen Sie den Betrag innerhalb von 14 Tagen.

Mit freundlichen Grüßen
${sender.name}`;

  // Convert HTML to base64 for attachment
  const htmlBase64 = Buffer.from(order.invoice_html, "utf-8").toString("base64");

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${sender.name} <${sender.email}>`,
      to: [`${customer.first_name} ${customer.last_name} <${customer.email}>`],
      subject,
      text,
      attachments: [
        {
          filename: `Rechnung-${invoiceNumber}.html`,
          content: htmlBase64,
          content_type: "text/html",
        },
      ],
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend Fehler:", errText);
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${errText}` }, { status: 500 });
  }

  // Mark as sent + log
  await supabaseAdmin.from("orders").update({ invoice_sent: true }).eq("id", id);
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "email_sent",
    description: `Rechnung ${invoiceNumber} per E-Mail gesendet an ${customer.email}`,
  });

  return NextResponse.json({ success: true });
}
