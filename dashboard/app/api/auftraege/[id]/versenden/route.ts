import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

const CARRIER_URLS: Record<string, string> = {
  dhl:         "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=",
  dpd:         "https://tracking.dpd.de/status/de_DE/parcel/",
  ups:         "https://www.ups.com/track?tracknum=",
  gls:         "https://gls-group.com/track/",
  hermes:      "https://www.myhermes.de/empfangen/sendungsverfolgung/#",
  fedex:       "https://www.fedex.com/fedextrack/?trknbr=",
  dhl_express: "https://www.dhl.com/de-de/home/tracking/tracking-parcel.html?submit=1&tracking-id=",
};

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "jose.rodri3006@gmail.com";

  const body = await req.json().catch(() => ({}));
  const { tracking_number, tracking_carrier } = body;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(first_name, last_name, email)`)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });

  const updates: Record<string, unknown> = { status: "versendet" };
  if (tracking_number) updates.tracking_number = tracking_number;
  if (tracking_carrier) updates.tracking_carrier = tracking_carrier;

  await supabaseAdmin.from("orders").update(updates).eq("id", id);
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "status_change",
    from_status: order.status,
    to_status: "versendet",
    description: tracking_number
      ? `Versandt — Sendungsnr. ${tracking_number}${tracking_carrier ? ` via ${tracking_carrier.toUpperCase()}` : ""}`
      : "Als versendet markiert",
  });

  if (!RESEND_API_KEY) return NextResponse.json({ success: true, warning: "Kein RESEND_API_KEY" });

  const defaultSender = getSender(order.venture);
  const customer = order.customer;
  const ref = order.invoice_number ?? order.id.slice(0, 8).toUpperCase();
  const customerName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim();
  const trackingUrl = tracking_number && tracking_carrier
    ? (CARRIER_URLS[tracking_carrier] ?? "") + tracking_number
    : "";

  const vars = {
    orderRef:        ref,
    orderTitle:      order.title ?? "",
    customerName:    customerName,
    customerEmail:   customer?.email ?? "—",
    trackingNumber:  tracking_number ?? "—",
    trackingCarrier: tracking_carrier ? tracking_carrier.toUpperCase() : "—",
    trackingUrl:     trackingUrl,
  };

  const trackingBlock = tracking_number
    ? `\nSendungsnummer: ${tracking_number}${tracking_carrier ? ` (${tracking_carrier.toUpperCase()})` : ""}${trackingUrl ? `\nTracking:       ${trackingUrl}` : ""}`
    : "";

  const mails = [];

  // Mail an Käufer
  if (customer?.email) {
    const tpl = await getTemplate(order.venture, "order_shipped_customer");
    const sender = tpl ? { name: tpl.from_name, email: tpl.from_email } : defaultSender;
    mails.push(sendMail(RESEND_API_KEY, {
      from: `${sender.name} <${sender.email}>`,
      to: [`${customerName} <${customer.email}>`],
      subject: tpl ? resolve(tpl.subject, vars) : `Ihre Bestellung ${ref} wurde versendet`,
      text: tpl
        ? `${resolve(tpl.intro_text, vars)}\n\n${resolve(tpl.footer_text, vars)}`
        : `Hallo ${customerName},\n\nIhre Bestellung „${order.title}" (${ref}) ist auf dem Weg zu Ihnen!${trackingBlock}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nViele Grüße\n${defaultSender.name}`,
    }));
  }

  // Mail an Admin/Verkäufer
  const tplAdmin = await getTemplate(order.venture, "order_shipped_admin");
  const senderAdmin = tplAdmin ? { name: tplAdmin.from_name, email: tplAdmin.from_email } : defaultSender;
  mails.push(sendMail(RESEND_API_KEY, {
    from: `${senderAdmin.name} <${senderAdmin.email}>`,
    to: [FOUNDER_EMAIL],
    subject: tplAdmin ? resolve(tplAdmin.subject, vars) : `[Versendet] ${order.title} — ${ref}`,
    text: tplAdmin
      ? `${resolve(tplAdmin.intro_text, vars)}\n\n${resolve(tplAdmin.footer_text, vars)}`
      : `Bestellung als versendet markiert:\n\nTitel: ${order.title}\nRef:   ${ref}\nKunde: ${customerName} <${customer?.email ?? "—"}>${trackingBlock}\nVenture: ${order.venture}`,
  }));

  await Promise.allSettled(mails);
  return NextResponse.json({ success: true });
}
