import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";

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
  if (action === "approve")   newStatus = "approved";
  if (action === "reject")    newStatus = "rejected";
  if (action === "complete")  newStatus = "completed";

  await supabaseAdmin.from("returns").update({
    status: newStatus,
    notes: notes ?? ret.notes,
    refund_amount: refund_amount ?? ret.refund_amount,
    refund_method: refund_method ?? ret.refund_method,
    processed_at: newStatus !== "requested" ? new Date().toISOString() : ret.processed_at,
  }).eq("id", id);

  if (!RESEND_API_KEY || !ret.customer_email) return NextResponse.json({ success: true });

  const sender = getSender(ret.venture);
  const customerName = ret.customer_name ?? "Kunde";

  let subject = "";
  let text = "";

  if (action === "approve") {
    subject = `Ihre Retoure wurde genehmigt`;
    text = `Hallo ${customerName},\n\nIhre Rückgabeanfrage wurde genehmigt.${refund_amount ? `\n\nRückerstattungsbetrag: ${Number(refund_amount).toFixed(2).replace(".", ",")} €${refund_method ? ` (${refund_method})` : ""}` : ""}\n\nBitte senden Sie die Ware innerhalb von 14 Tagen zurück. Vielen Dank.\n\n${sender.name}`;
  } else if (action === "reject") {
    subject = `Zu Ihrer Rückgabeanfrage`;
    text = `Hallo ${customerName},\n\nleider konnten wir Ihre Rückgabeanfrage nicht genehmigen.${notes ? `\n\nGrund: ${notes}` : ""}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n${sender.name}`;
  } else if (action === "complete") {
    subject = `Rückerstattung veranlasst`;
    text = `Hallo ${customerName},\n\nIhre Retoure ist abgeschlossen.${refund_amount ? ` Eine Rückerstattung von ${Number(refund_amount).toFixed(2).replace(".", ",")} €${refund_method ? ` via ${refund_method}` : ""} wird veranlasst.` : ""}\n\nVielen Dank.\n\n${sender.name}`;
  }

  if (subject) {
    await Promise.allSettled([
      sendMail(RESEND_API_KEY, {
        from: `${sender.name} <${sender.email}>`,
        to: [`${customerName} <${ret.customer_email}>`],
        subject,
        text,
      }),
      sendMail(RESEND_API_KEY, {
        from: `${sender.name} <${sender.email}>`,
        to: [FOUNDER_EMAIL],
        subject: `[Retoure ${newStatus.toUpperCase()}] ${customerName} — ${ret.venture}`,
        text: `Retoure bearbeitet:\n\nKunde: ${customerName} <${ret.customer_email}>\nAktion: ${action}\nGrund: ${ret.reason ?? "—"}\nRückerstattung: ${refund_amount ? Number(refund_amount).toFixed(2) + " €" : "—"}`,
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
