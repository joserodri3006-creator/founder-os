import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "jose.rodri3006@gmail.com";

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(first_name, last_name, email)`)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (order.status === "storniert") return NextResponse.json({ error: "Bereits storniert" }, { status: 400 });

  const prevStatus = order.status;

  await supabaseAdmin.from("orders").update({ status: "storniert" }).eq("id", id);
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "status_change",
    from_status: prevStatus,
    to_status: "storniert",
    description: "Bestellung storniert",
  });

  if (!RESEND_API_KEY) return NextResponse.json({ success: true, warning: "Kein RESEND_API_KEY" });

  const sender = getSender(order.venture);
  const customer = order.customer;
  const ref = order.invoice_number ?? order.id.slice(0, 8).toUpperCase();
  const customerName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();

  const mails = [];

  if (customer?.email) {
    mails.push(sendMail(RESEND_API_KEY, {
      from: `${sender.name} <${sender.email}>`,
      to: [`${customerName} <${customer.email}>`],
      subject: `Stornierungsbestätigung — Bestellung ${ref}`,
      text: `Hallo ${customerName},\n\nwir bestätigen die Stornierung Ihrer Bestellung „${order.title}" (${ref}).\n\nFalls Sie Fragen haben, antworten Sie einfach auf diese E-Mail.\n\nMit freundlichen Grüßen\n${sender.name}`,
    }));
  }

  mails.push(sendMail(RESEND_API_KEY, {
    from: `${sender.name} <${sender.email}>`,
    to: [FOUNDER_EMAIL],
    subject: `[Stornierung] ${order.title} — ${ref}`,
    text: `Bestellung storniert:\n\nTitel: ${order.title}\nRef:   ${ref}\nKunde: ${customerName} <${customer?.email ?? "—"}>\nWert:  ${order.value != null ? order.value.toLocaleString("de-DE") + " €" : "—"}\nVenture: ${order.venture}`,
  }));

  await Promise.allSettled(mails);
  return NextResponse.json({ success: true });
}
