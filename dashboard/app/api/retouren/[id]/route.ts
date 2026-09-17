import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail, resolve, getTemplate } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

type ReturnItem = { name?: string; product_name?: string; qty?: number; quantity?: number };

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

    const { data: variant, error: variantError } = await supabaseAdmin
      .from("product_variants")
      .select("id, track_inventory, is_active")
      .eq("product_id", orderItem.product_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (variantError) throw new Error(variantError.message);
    if (!variant?.id || variant.track_inventory === false) { skipped++; continue; }

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
  const { action, notes, refund_amount, refund_method, restore_stock } = body;

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
    } catch (stockError) {
      return NextResponse.json(
        { error: stockError instanceof Error ? stockError.message : "Lagerrückbuchung fehlgeschlagen" },
        { status: 500 },
      );
    }
  }

  const finalNotes = [notes ?? ret.notes, stockNote].filter(Boolean).join("\n");

  await supabaseAdmin.from("returns").update({
    status: newStatus,
    notes: finalNotes || null,
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
