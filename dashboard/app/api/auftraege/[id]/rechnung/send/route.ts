import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(id, first_name, last_name, company_name, email)`)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (!order.invoice_html) return NextResponse.json({ error: "Bitte zuerst Rechnung generieren" }, { status: 400 });

  const customer = order.customer;
  if (!customer?.email) return NextResponse.json({ error: "Kunde hat keine E-Mail-Adresse" }, { status: 400 });

  const defaultSender = getSender(order.venture);
  const invoiceNumber = order.invoice_number ?? id;
  const customerName = `${customer.first_name} ${customer.last_name}`;

  const vars = {
    customerName:  customerName,
    invoiceNumber: invoiceNumber,
    orderTitle:    order.title ?? "",
    orderRef:      invoiceNumber,
  };

  const tpl = await getTemplate(order.venture, "invoice_send_customer");
  const sender = tpl ? { name: tpl.from_name, email: tpl.from_email } : defaultSender;

  const subject = tpl
    ? resolve(tpl.subject, vars)
    : `Ihre Rechnung ${invoiceNumber} — ${order.title}`;

  const text = tpl
    ? `${resolve(tpl.intro_text, vars)}\n\n${resolve(tpl.footer_text, vars)}`
    : `Sehr geehrte/r ${customerName},\n\nvielen Dank für Ihren Auftrag „${order.title}".\n\nIm Anhang finden Sie Ihre Rechnung mit der Nummer ${invoiceNumber}.\n\nBitte überweisen Sie den Betrag innerhalb von 14 Tagen.\n\nMit freundlichen Grüßen\n${defaultSender.name}`;

  const htmlBase64 = Buffer.from(order.invoice_html, "utf-8").toString("base64");

  const resendRes = await sendMail(RESEND_API_KEY, {
    from: `${sender.name} <${sender.email}>`,
    to: [`${customerName} <${customer.email}>`],
    subject,
    text,
    attachments: [
      {
        filename: `Rechnung-${invoiceNumber}.html`,
        content: htmlBase64,
        content_type: "text/html",
      },
    ],
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend Fehler:", errText);
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${errText}` }, { status: 500 });
  }

  await supabaseAdmin.from("orders").update({ invoice_sent: true }).eq("id", id);
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "email_sent",
    description: `Rechnung ${invoiceNumber} per E-Mail gesendet an ${customer.email}`,
  });

  return NextResponse.json({ success: true });
}
