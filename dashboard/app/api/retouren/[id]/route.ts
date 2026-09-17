import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

type ReturnItem = { name?: string; product_name?: string; qty?: number; quantity?: number };

async function logReturnEvent(returnId: string, venture: string, eventType: string, message: string, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from("return_events").insert({
    return_id: returnId,
    venture,
    event_type: eventType,
    message,
    metadata,
  });
}

function returnItemName(item: ReturnItem) {
  return item.name ?? item.product_name ?? "";
}

function returnItemQty(item: ReturnItem) {
  const qty = item.qty ?? item.quantity ?? 0;
  return Number.isFinite(Number(qty)) ? Number(qty) : 0;
}

async function restoreReturnItemsToStock(ret: { id: string; order_id: string | null; venture: string; items: ReturnItem[] | null }) {
  if (!ret.order_id || !Array.isArray(ret.items) || ret.items.length === 0) {
    return { restored: 0, skipped: 0 };
  }

  const { data: existingMovement, error: existingError } = await supabaseAdmin
    .from("inventory_movements")
    .select("id")
    .eq("reference_type", "return")
    .eq("reference_id", ret.id)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existingMovement) return { restored: 0, skipped: ret.items.length };

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_name, sku, quantity")
    .eq("order_id", ret.order_id);
  if (orderItemsError) throw new Error(orderItemsError.message);

  let restored = 0;
  let skipped = 0;

  for (const item of ret.items) {
    const name = returnItemName(item);
    const qty = returnItemQty(item);
    if (!name || qty <= 0) { skipped++; continue; }

    const orderItem = (orderItems ?? []).find((oi) => oi.product_name === name);
    if (!orderItem?.product_id) { skipped++; continue; }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("track_inventory")
      .eq("id", orderItem.product_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (product?.track_inventory === false) { skipped++; continue; }

    const { data: variant, error: variantError } = await supabaseAdmin
      .from("product_variants")
      .select("id, is_active")
      .eq("product_id", orderItem.product_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (variantError) throw new Error(variantError.message);
    if (!variant?.id) { skipped++; continue; }

    const { error: movementError } = await supabaseAdmin.from("inventory_movements").insert({
      venture: ret.venture,
      product_id: orderItem.product_id,
      variant_id: variant.id,
      type: "return",
      quantity: Math.abs(qty),
      reference_type: "return",
      reference_id: ret.id,
      note: `Retoure abgeschlossen · ${name}`,
    });
    if (movementError) throw new Error(movementError.message);
    restored += 1;
  }

  return { restored, skipped };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "jose.rodri3006@gmail.com";
  const body = await req.json();
  const {
    action,
    notes,
    refund_amount,
    refund_method,
    restore_stock,
    customer_subject,
    customer_text,
    return_shipping_cost,
    refund_gross_amount,
    return_label_attachment_id,
    return_label_url,
  } = body;

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

  let stockNote = "";
  if (action === "complete" && restore_stock === true && ret.status !== "completed") {
    try {
      const result = await restoreReturnItemsToStock(ret);
      stockNote = `Lager zurückgebucht: ${result.restored} Position(en)${result.skipped ? `, ${result.skipped} übersprungen` : ""}.`;
      await logReturnEvent(ret.id, ret.venture, "stock_restored", stockNote, result);
    } catch (stockError) {
      return NextResponse.json(
        { error: stockError instanceof Error ? stockError.message : "Lagerrückbuchung fehlgeschlagen" },
        { status: 500 },
      );
    }
  }

  const finalNotes = [notes ?? ret.notes, stockNote].filter(Boolean).join("\n");

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    notes: finalNotes || null,
    refund_amount: refund_amount ?? ret.refund_amount,
    refund_method: refund_method ?? ret.refund_method,
    processed_at: newStatus !== "requested" ? new Date().toISOString() : ret.processed_at,
  };
  if (return_shipping_cost !== undefined) updatePayload.return_shipping_cost = return_shipping_cost;
  if (refund_gross_amount !== undefined) updatePayload.refund_gross_amount = refund_gross_amount;
  if (return_label_attachment_id) updatePayload.return_label_attachment_id = return_label_attachment_id;
  if (return_label_url) updatePayload.return_label_url = return_label_url;
  if (stockNote) updatePayload.stock_restored_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin.from("returns").update(updatePayload).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const eventType = action === "approve" ? "approved" : action === "reject" ? "rejected" : "completed";
  await logReturnEvent(ret.id, ret.venture, eventType, finalNotes || `Retoure ${newStatus}`, {
    refund_amount: refund_amount ?? ret.refund_amount ?? null,
    refund_method: refund_method ?? ret.refund_method ?? null,
    return_shipping_cost: return_shipping_cost ?? ret.return_shipping_cost ?? null,
    return_label_attachment_id: return_label_attachment_id ?? null,
    return_label_url: return_label_url ?? null,
  });

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

  let labelAttachment: { filename: string; content: string; content_type: string } | null = null;
  let labelLinkText = "";
  if (return_label_attachment_id) {
    const { data: att } = await supabaseAdmin
      .from("attachments")
      .select("filename, storage_path, mime_type")
      .eq("id", return_label_attachment_id)
      .maybeSingle();
    if (att?.storage_path) {
      const { data: fileBlob } = await supabaseAdmin.storage.from("attachments").download(att.storage_path);
      if (fileBlob) {
        labelAttachment = {
          filename: att.filename ?? "Retoureschein.pdf",
          content: Buffer.from(await fileBlob.arrayBuffer()).toString("base64"),
          content_type: att.mime_type ?? "application/pdf",
        };
      }
    }
  }
  if (return_label_url) labelLinkText = `\n\nRetoureschein/Link: ${return_label_url}`;

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

  const subject = typeof customer_subject === "string" && customer_subject.trim()
    ? customer_subject.trim()
    : tplCustomer ? resolve(tplCustomer.subject, vars) : fallbackSubject[action];
  const text = typeof customer_text === "string" && customer_text.trim()
    ? customer_text.trim()
    : tplCustomer
      ? `${resolve(tplCustomer.intro_text, vars)}\n\n${resolve(tplCustomer.footer_text, vars)}`
      : fallbackText[action];

  await Promise.allSettled([
    // Kundenmail
    sendMail(RESEND_API_KEY, {
      from:    `${senderCustomer.name} <${senderCustomer.email}>`,
      to:      [`${customerName} <${ret.customer_email}>`],
      subject,
      text:    `${text}${labelLinkText}`,
      attachments: labelAttachment ? [labelAttachment] : undefined,
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

  await logReturnEvent(ret.id, ret.venture, "customer_email_sent", `Kundenmail gesendet: ${subject}`, { action, subject });

  return NextResponse.json({ success: true });
}
