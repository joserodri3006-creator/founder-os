import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "jose.rodri3006@gmail.com";
  const body = await req.json();
  const { action, notes, refund_amount, refund_method } = body;

  const { data: ret, error } = await supabaseAdmin
    .from("returns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !ret) return NextResponse.json({ error: "Retoure nicht gefunden" }, { status: 404 });

  let newStatus = ret.status;
  if (action === "approve")  newStatus = "approved";
  if (action === "reject")   newStatus = "rejected";
  if (action === "complete") newStatus = "completed";

  await supabaseAdmin.from("returns").update({
    status: newStatus,
    notes: notes ?? ret.notes,
    refund_amount: refund_amount ?? ret.refund_amount,
    refund_method: refund_method ?? ret.refund_method,
    processed_at: newStatus !== "requested" ? new Date().toISOString() : ret.processed_at,
  }).eq("id", id);

  if (!RESEND_API_KEY || !ret.customer_email) return NextResponse.json({ success: true });

  const defaultSender = getSender(ret.venture);
  const customerName = ret.customer_name ?? "Kunde";
  const refundAmountFmt = refund_amount
    ? `${Number(refund_amount).toFixed(2).replace(".", ",")} €`
    : "—";

  const vars = {
    customerName:  customerName,
    customerEmail: ret.customer_email,
    refundAmount:  refundAmountFmt,
    refundMethod:  refund_method ?? ret.refund_method ?? "—",
    reason:        notes ?? ret.reason ?? "—",
    orderRef:      ret.order_id ? ret.order_id.slice(0, 8).toUpperCase() : "—",
  };

  // Template key per action
  const tplKeyCustomer: Record<string, string> = {
    approve:  "return_approved_customer",
    reject:   "return_rejected_customer",
    complete: "return_completed_customer",
  };

  // Fallback texts
  const fallbackSubject: Record<string, string> = {
    approve:  "Ihre Retoure wurde genehmigt",
    reject:   "Zu Ihrer Rückgabeanfrage",
    complete: "Rückerstattung veranlasst",
  };
  const fallbackText: Record<string, string> = {
    approve:  `Hallo ${customerName},\n\nIhre Rückgabeanfrage wurde genehmigt.${refund_amount ? `\n\nRückerstattungsbetrag: ${refundAmountFmt}${refund_method ? ` (${refund_method})` : ""}` : ""}\n\nBitte senden Sie die Ware innerhalb von 14 Tagen zurück. Vielen Dank.\n\n${defaultSender.name}`,
    reject:   `Hallo ${customerName},\n\nleider konnten wir Ihre Rückgabeanfrage nicht genehmigen.${notes ? `\n\nGrund: ${notes}` : ""}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n${defaultSender.name}`,
    complete: `Hallo ${customerName},\n\nIhre Retoure ist abgeschlossen.${refund_amount ? ` Eine Rückerstattung von ${refundAmountFmt}${refund_method ? ` via ${refund_method}` : ""} wird veranlasst.` : ""}\n\nVielen Dank.\n\n${defaultSender.name}`,
  };

  if (!tplKeyCustomer[action]) return NextResponse.json({ success: true });

  const [tplCustomer, tplAdmin] = await Promise.all([
    getTemplate(ret.venture, tplKeyCustomer[action]),
    getTemplate(ret.venture, "return_admin_notification"),
  ]);

  const senderCustomer = tplCustomer ? { name: tplCustomer.from_name, email: tplCustomer.from_email } : defaultSender;
  const senderAdmin    = tplAdmin    ? { name: tplAdmin.from_name,    email: tplAdmin.from_email    } : defaultSender;

  await Promise.allSettled([
    // Kundenmail
    sendMail(RESEND_API_KEY, {
      from:    `${senderCustomer.name} <${senderCustomer.email}>`,
      to:      [`${customerName} <${ret.customer_email}>`],
      subject: tplCustomer ? resolve(tplCustomer.subject, vars) : fallbackSubject[action],
      text:    tplCustomer
        ? `${resolve(tplCustomer.intro_text, vars)}\n\n${resolve(tplCustomer.footer_text, vars)}`
        : fallbackText[action],
    }),
    // Admin-Notification
    sendMail(RESEND_API_KEY, {
      from:    `${senderAdmin.name} <${senderAdmin.email}>`,
      to:      [FOUNDER_EMAIL],
      subject: tplAdmin
        ? resolve(tplAdmin.subject, { ...vars, action: newStatus.toUpperCase() })
        : `[Retoure ${newStatus.toUpperCase()}] ${customerName} — ${ret.venture}`,
      text: tplAdmin
        ? `${resolve(tplAdmin.intro_text, { ...vars, action: newStatus.toUpperCase() })}\n\n${resolve(tplAdmin.footer_text, { ...vars, action: newStatus.toUpperCase() })}`
        : `Retoure bearbeitet:\n\nKunde: ${customerName} <${ret.customer_email}>\nAktion: ${action}\nGrund: ${ret.reason ?? "—"}\nRückerstattung: ${refund_amount ? `${Number(refund_amount).toFixed(2)} €` : "—"}`,
    }),
  ]);

  return NextResponse.json({ success: true });
}
