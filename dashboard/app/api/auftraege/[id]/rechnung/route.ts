import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

// --- Venture Branding ---
const VENTURE_INFO: Record<string, {
  name: string;
  address: string;
  city: string;
  email: string;
  website: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
  logoColor: string;
}> = {
  online_first: {
    name: "Online First",
    address: "Musterstraße 1",
    city: "12345 Berlin",
    email: "info@onlinefirst.eu",
    website: "www.onlinefirst.eu",
    taxId: "DE123456789",
    bankName: "Sparkasse",
    iban: "DE00 0000 0000 0000 0000 00",
    bic: "BELADEBE",
    logoColor: "#2563eb",
  },
  brandary: {
    name: "Brandary Print Studio",
    address: "Druckgasse 5",
    city: "10115 Berlin",
    email: "info@brandary.de",
    website: "www.brandary.de",
    taxId: "DE987654321",
    bankName: "Deutsche Bank",
    iban: "DE00 0000 0000 0000 0000 00",
    bic: "DEUTDEDB",
    logoColor: "#16a34a",
  },
  droplane: {
    name: "Droplane",
    address: "Kreativweg 12",
    city: "20099 Hamburg",
    email: "info@droplane.de",
    website: "www.droplane.de",
    taxId: "DE112233445",
    bankName: "Volksbank",
    iban: "DE00 0000 0000 0000 0000 00",
    bic: "VOBADEBB",
    logoColor: "#7c3aed",
  },
  blazed_outfitters: {
    name: "Blazed Outfitters",
    address: "Fashion Street 8",
    city: "80331 München",
    email: "info@blazedoutfitters.com",
    website: "www.blazedoutfitters.com",
    taxId: "DE556677889",
    bankName: "HypoVereinsbank",
    iban: "DE00 0000 0000 0000 0000 00",
    bic: "HYVEDEMMXXX",
    logoColor: "#ea580c",
  },
  worknest: {
    name: "Worknest",
    address: "B2B Allee 3",
    city: "70173 Stuttgart",
    email: "info@worknest.de",
    website: "www.worknest.de",
    taxId: "DE998877665",
    bankName: "Commerzbank",
    iban: "DE00 0000 0000 0000 0000 00",
    bic: "COBADEFFXXX",
    logoColor: "#0d9488",
  },
};

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RE-${year}${month}${day}-${rand}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface InvoiceData {
  recipientName: string;
  recipientCompany: string;
  recipientAddress: string;
  positions: { description: string; details?: string; net: number }[];
  taxRate: number; // e.g. 19
  notes: string;
  dueDays: number;
}

function buildInvoiceHtml(
  order: any,
  venture: typeof VENTURE_INFO[string],
  invoiceNumber: string,
  data: InvoiceData
): string {
  const today = new Date().toLocaleDateString("de-DE");
  const dueDate = new Date(Date.now() + data.dueDays * 86400000).toLocaleDateString("de-DE");

  const netTotal = data.positions.reduce((s, p) => s + p.net, 0);
  const tax = Math.round(netTotal * (data.taxRate / 100) * 100) / 100;
  const gross = Math.round((netTotal + tax) * 100) / 100;

  const customerName = data.recipientName || "—";
  const customerCompany = data.recipientCompany ? `<div>${data.recipientCompany}</div>` : "";
  const customerCity = data.recipientAddress ?? "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: white; }
    .page { max-width: 800px; margin: 0 auto; padding: 60px 60px 80px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
    .logo { font-size: 22px; font-weight: 700; color: ${venture.logoColor}; letter-spacing: -0.5px; }
    .header-right { text-align: right; color: #555; font-size: 12px; line-height: 1.8; }

    /* Addresses */
    .addresses { display: flex; justify-content: space-between; margin-bottom: 48px; }
    .address-block { font-size: 12px; line-height: 1.8; color: #333; }
    .address-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 6px; font-weight: 600; }

    /* Invoice Title */
    .invoice-title { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid ${venture.logoColor}; }
    .invoice-title h1 { font-size: 26px; font-weight: 700; color: ${venture.logoColor}; }
    .invoice-meta { font-size: 12px; color: #555; line-height: 1.8; text-align: right; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    thead tr { background: ${venture.logoColor}; color: white; }
    th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child, td:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid #e5e7eb; }
    tbody tr:last-child { border-bottom: none; }
    td { padding: 12px 14px; font-size: 13px; color: #333; vertical-align: top; }
    .item-desc { font-size: 11px; color: #666; margin-top: 3px; }

    /* Totals */
    .totals { margin-left: auto; width: 280px; margin-bottom: 48px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #555; }
    .total-row.main { border-top: 2px solid ${venture.logoColor}; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 15px; color: #1a1a1a; }

    /* Payment */
    .payment { background: #f8f9fa; border-left: 3px solid ${venture.logoColor}; padding: 16px 20px; margin-bottom: 32px; font-size: 12px; line-height: 1.8; }
    .payment strong { font-size: 12px; color: #333; display: block; margin-bottom: 6px; }

    /* Footer */
    .footer { text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 20px; line-height: 1.8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo">${venture.name}</div>
      <div class="header-right">
        <div>${venture.address}</div>
        <div>${venture.city}</div>
        <div>${venture.email}</div>
        <div>${venture.website}</div>
      </div>
    </div>

    <!-- Addresses -->
    <div class="addresses">
      <div class="address-block">
        <div class="address-label">Rechnungsempfänger</div>
        ${customerCompany}
        <div>${customerName}</div>
        <div>${customerCity}</div>
      </div>
      <div class="address-block" style="text-align:right;">
        <div class="address-label">Von</div>
        <div>${venture.name}</div>
        <div>${venture.address}</div>
        <div>${venture.city}</div>
      </div>
    </div>

    <!-- Invoice Title -->
    <div class="invoice-title">
      <h1>Rechnung</h1>
      <div class="invoice-meta">
        <div><strong>Rechnungsnr.:</strong> ${invoiceNumber}</div>
        <div><strong>Datum:</strong> ${today}</div>
        <div><strong>Fällig am:</strong> ${dueDate}</div>
      </div>
    </div>

    <!-- Line Items -->
    <table>
      <thead>
        <tr>
          <th style="width:60%">Leistung</th>
          <th style="width:20%">Netto</th>
          <th style="width:20%">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${data.positions.map(p => `
        <tr>
          <td>
            ${p.description}
            ${p.details ? `<div class="item-desc">${p.details}</div>` : ""}
          </td>
          <td>${formatCurrency(p.net)} €</td>
          <td>${formatCurrency(p.net)} €</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row"><span>Nettobetrag</span><span>${formatCurrency(netTotal)} €</span></div>
      <div class="total-row"><span>MwSt. ${data.taxRate}%</span><span>${formatCurrency(tax)} €</span></div>
      <div class="total-row main"><span>Gesamtbetrag</span><span>${formatCurrency(gross)} €</span></div>
    </div>

    <!-- Payment Info -->
    <div class="payment">
      <strong>Zahlungsinformationen</strong>
      <div>Bank: ${venture.bankName}</div>
      <div>IBAN: ${venture.iban}</div>
      <div>BIC: ${venture.bic}</div>
      <div style="margin-top:6px;color:#555;">Verwendungszweck: <strong>${invoiceNumber}</strong></div>
      <div>Bitte überweisen Sie den Betrag bis spätestens <strong>${dueDate}</strong>.</div>
      ${data.notes ? `<div style="margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">${data.notes}</div>` : ""}
    </div>

    <!-- Footer -->
    <div class="footer">
      ${venture.name} · ${venture.address}, ${venture.city} · ${venture.email} · Steuernummer: ${venture.taxId}
    </div>
  </div>
</body>
</html>`;
}

// GET — ?data=1 returns invoice_data JSON; otherwise downloads HTML
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("invoice_html, invoice_number, invoice_data, title, value, description, package_type, customer:customers(first_name, last_name, company_name, city)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  // Return JSON data for editor
  if (searchParams.get("data") === "1") {
    const customer = data.customer as any;
    const defaults: InvoiceData = {
      recipientName: customer ? `${customer.first_name} ${customer.last_name}` : "",
      recipientCompany: customer?.company_name ?? "",
      recipientAddress: customer?.city ?? "",
      positions: [{ description: (data as any).title, details: (data as any).description ?? undefined, net: (data as any).value ?? 0 }],
      taxRate: 19,
      notes: "",
      dueDays: 14,
    };
    return NextResponse.json((data.invoice_data as InvoiceData) ?? defaults);
  }

  if (!data.invoice_html) return NextResponse.json({ error: "Noch keine Rechnung generiert" }, { status: 404 });

  return new NextResponse(data.invoice_html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="Rechnung-${data.invoice_number ?? id}.html"`,
    },
  });
}

async function getVentureInfo(ventureId: string): Promise<typeof VENTURE_INFO[string]> {
  const { data } = await supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", `${ventureId}_venture_info`)
    .single();
  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      // Merge with hardcoded fallback so missing fields still work
      return { ...VENTURE_INFO[ventureId] ?? VENTURE_INFO.online_first, ...parsed };
    } catch { /* ignore */ }
  }
  return VENTURE_INFO[ventureId] ?? VENTURE_INFO.online_first;
}

// POST — generate invoice (or regenerate). Body may contain invoice_data overrides.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(id, first_name, last_name, company_name, email, phone, city)`)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });

  // Body may supply edited invoice_data; otherwise use stored or build defaults
  let bodyData: Partial<InvoiceData> = {};
  try { bodyData = await req.json(); } catch { /* no body */ }

  const stored: Partial<InvoiceData> = order.invoice_data ?? {};
  const customer = order.customer;

  const invoiceData: InvoiceData = {
    recipientName: bodyData.recipientName ?? stored.recipientName ?? (customer ? `${customer.first_name} ${customer.last_name}` : ""),
    recipientCompany: bodyData.recipientCompany ?? stored.recipientCompany ?? (customer?.company_name ?? ""),
    recipientAddress: bodyData.recipientAddress ?? stored.recipientAddress ?? (customer?.city ?? ""),
    positions: bodyData.positions ?? stored.positions ?? [{ description: order.title, details: order.description ?? undefined, net: order.value ?? 0 }],
    taxRate: bodyData.taxRate ?? stored.taxRate ?? 19,
    notes: bodyData.notes ?? stored.notes ?? "",
    dueDays: bodyData.dueDays ?? stored.dueDays ?? 14,
  };

  const venture = await getVentureInfo(order.venture);
  const invoiceNumber = order.invoice_number ?? generateInvoiceNumber();
  const html = buildInvoiceHtml(order, venture, invoiceNumber, invoiceData);

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      invoice_html: html,
      invoice_number: invoiceNumber,
      invoice_generated_at: new Date().toISOString(),
      invoice_data: invoiceData,
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Log activity
  await supabaseAdmin.from("order_activities").insert({
    order_id: id,
    activity_type: "note",
    description: `Rechnung ${invoiceNumber} generiert`,
  });

  return NextResponse.json({ success: true, invoice_number: invoiceNumber });
}
