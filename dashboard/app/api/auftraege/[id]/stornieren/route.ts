import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

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

  const defaultSender = getSender(order.venture);
  const customer = order.customer;
  const ref = order.invoice_number ?? order.id.slice(0, 8).toUpperCase();
  const customerName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();

  const vars = {
    orderRef:     ref,
    orderTitle:   order.title ?? "",
    customerName: customerName,
    customerEmail: customer?.email ?? "—",
    orderValue:   order.value != null ? `${order.value.toLocaleString("de-DE")} €` : "—",
  };

  const mails = [];

  // Mail an Käufer
  if (customer?.email) {
    const tpl = await getTemplate(order.venture, "order_cancellation_customer");
    const sender = tpl ? { name: tpl.from_name, email: tpl.from_email } : defaultSender;
    mails.push(sendMail(RESEND_API_KEY, {
      from: `${sender.name} <${sender.email}>`,
      to: [`${customerName} <${customer.email}>`],
      subject: tpl ? resolve(tpl.subject, vars) : `Stornierungsbestätigung — Bestellung ${ref}`,
      text: tpl
        ? `${resolve(tpl.intro_text, vars)}\n\n${resolve(tpl.footer_text, vars)}`
        : `Hallo ${customerName},\n\nwir bestätigen die Stornierung Ihrer Bestellung „${order.title}" (${ref}).\n\nFalls Sie Fragen haben, antworten Sie einfach auf diese E-Mail.\n\nMit freundlichen Grüßen\n${defaultSender.name}`,
    }));
  }

  // Mail an Admin/Verkäufer
  const tplAdmin = await getTemplate(order.venture, "order_cancellation_admin");
  const senderAdmin = tplAdmin ? { name: tplAdmin.from_name, email: tplAdmin.from_email } : defaultSender;
  mails.push(sendMail(RESEND_API_KEY, {
    from: `${senderAdmin.name} <${senderAdmin.email}>`,
    to: [FOUNDER_EMAIL],
    subject: tplAdmin ? resolve(tplAdmin.subject, vars) : `[Stornierung] ${order.title} — ${ref}`,
    text: tplAdmin
      ? `${resolve(tplAdmin.intro_text, vars)}\n\n${resolve(tplAdmin.footer_text, vars)}`
      : `Bestellung storniert:\n\nTitel: ${order.title}\nRef:   ${ref}\nKunde: ${customerName} <${customer?.email ?? "—"}>\nWert:  ${vars.orderValue}\nVenture: ${order.venture}`,
  }));

  await Promise.allSettled(mails);
  return NextResponse.json({ success: true });
}
