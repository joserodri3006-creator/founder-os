"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getVenture } from "@/lib/ventures";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import NotesField from "@/components/NotesField";

interface PaymentStep {
  step: number;
  label: string;
  percentage: number;
  trigger: string;
  due_days: number;
  amount: number;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
}

interface PaymentModel {
  id: string;
  name: string;
  payment_method: string;
}

interface Order {
  id: string;
  title: string;
  package_type: string | null;
  value: number | null;
  status: string;
  deadline: string | null;
  venture: string;
  created_at: string;
  notes: string | null;
  description: string | null;
  briefing_url: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  anzahlung_betrag: number | null;
  anzahlung_erhalten: boolean;
  restzahlung_erhalten: boolean;
  invoice_sent: boolean;
  invoice_number: string | null;
  invoice_generated_at: string | null;
  invoice_html: string | null;
  payment_model_id: string | null;
  payment_steps: PaymentStep[];
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
  } | null;
}

interface Activity {
  id: string;
  order_id: string;
  activity_type: string;
  from_status: string | null;
  to_status: string | null;
  description: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  bezahlt: "Bezahlt",
  briefing: "Briefing",
  in_bearbeitung: "In Bearbeitung",
  in_produktion: "In Produktion",
  versendet: "Versendet",
  review: "Review / Abnahme",
  abgeschlossen: "Abgeschlossen",
  nachbetreuung: "Nachbetreuung",
  storniert: "Storniert",
  pausiert: "Pausiert",
  angebot_gesendet: "Angebot gesendet",
};

const STATUS_COLORS: Record<string, string> = {
  neu: "bg-blue-100 text-blue-700",
  bezahlt: "bg-emerald-100 text-emerald-700",
  briefing: "bg-cyan-100 text-cyan-700",
  in_bearbeitung: "bg-yellow-100 text-yellow-700",
  in_produktion: "bg-orange-100 text-orange-700",
  versendet: "bg-indigo-100 text-indigo-700",
  review: "bg-purple-100 text-purple-700",
  abgeschlossen: "bg-green-100 text-green-700",
  nachbetreuung: "bg-teal-100 text-teal-700",
  storniert: "bg-red-100 text-red-700",
  pausiert: "bg-gray-100 text-gray-600",
  angebot_gesendet: "bg-sky-100 text-sky-700",
};

// Visuelle Reihenfolge der Status-Timeline
const STATUS_TIMELINE = ["neu", "briefing", "in_bearbeitung", "in_produktion", "versendet", "review", "abgeschlossen", "nachbetreuung"];

const ACTIVITY_COLORS: Record<string, string> = {
  status_change: "bg-blue-100 text-blue-700",
  email_sent: "bg-green-100 text-green-700",
  note: "bg-gray-100 text-gray-600",
  follow_up: "bg-orange-100 text-orange-600",
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function AuftragDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editBriefingUrl, setEditBriefingUrl] = useState("");
  const [editTracking, setEditTracking] = useState("");
  const [editCarrier, setEditCarrier] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [invoiceMsg, setInvoiceMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [invoiceEdit, setInvoiceEdit] = useState(false);
  const [availableModels, setAvailableModels] = useState<PaymentModel[]>([]);
  const [paymentModelLoading, setPaymentModelLoading] = useState<string | null>(null);
  // Bestellpositionen
  interface OrderItem {
    id: string; order_id: string; product_id: string | null;
    product_name: string; sku: string | null;
    quantity: number; unit_price: number; notes: string | null;
  }
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ product_name: "", sku: "", quantity: "1", unit_price: "", notes: "" });
  const [itemSaving, setItemSaving] = useState(false);

  // Versenden-Aktion
  const [showVersenden, setShowVersenden] = useState(false);
  const [versendForm, setVersendForm] = useState({ tracking_number: "", tracking_carrier: "" });
  const [versendSaving, setVersendSaving] = useState(false);

  // Storno
  const [stornoSaving, setStornoSaving] = useState(false);

  // Rechnungsvorschau
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  const [invoiceData, setInvoiceData] = useState<{
    recipientName: string;
    recipientCompany: string;
    recipientAddress: string;
    positions: { description: string; details: string; net: number }[];
    taxRate: number;
    notes: string;
    dueDays: number;
  } | null>(null);

  async function reload() {
    const [o, a, items] = await Promise.all([
      fetch(`/api/auftraege/${id}`).then(r => r.json()),
      fetch(`/api/auftraege/${id}/activities`).then(r => r.json()),
      fetch(`/api/auftraege/${id}/positionen`).then(r => r.json()),
    ]);
    setOrder(o);
    setEditStatus(o.status);
    setEditBriefingUrl(o.briefing_url ?? "");
    setEditTracking(o.tracking_number ?? "");
    setEditCarrier(o.tracking_carrier ?? "");
    setActivities(Array.isArray(a) ? a : []);
    setOrderItems(Array.isArray(items) ? items : []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [id]);

  useEffect(() => {
    if (!order) return;
    fetch(`/api/payment-models?venture=${order.venture}`)
      .then(r => r.json())
      .then(data => setAvailableModels(Array.isArray(data) ? data : []));
  }, [order?.venture]);

  async function patch(fields: Record<string, unknown>) {
    const key = Object.keys(fields)[0];
    setSaving(key);
    await fetch(`/api/auftraege/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await reload();
    setSaving(null);
  }

  async function togglePaymentStep(step: number, paid: boolean) {
    setPaymentModelLoading(`step-${step}`);
    const res = await fetch(`/api/auftraege/${id}/payment-steps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, paid }),
    });
    if (res.ok) await reload();
    setPaymentModelLoading(null);
  }

  async function applyPaymentModel(modelId: string) {
    setPaymentModelLoading("model");
    const res = await fetch(`/api/auftraege/${id}/payment-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    });
    if (res.ok) await reload();
    setPaymentModelLoading(null);
  }

  async function openInvoiceEditor() {
    const res = await fetch(`/api/auftraege/${id}/rechnung?data=1`);
    const data = await res.json();
    setInvoiceData({
      recipientName: data.recipientName ?? "",
      recipientCompany: data.recipientCompany ?? "",
      recipientAddress: data.recipientAddress ?? "",
      positions: (data.positions ?? [{ description: "", details: "", net: 0 }]).map((p: any) => ({
        description: p.description ?? "",
        details: p.details ?? "",
        net: p.net ?? 0,
      })),
      taxRate: data.taxRate ?? 19,
      notes: data.notes ?? "",
      dueDays: data.dueDays ?? 14,
    });
    setInvoiceEdit(true);
  }

  async function generateInvoice() {
    setInvoiceLoading("generate");
    setInvoiceMsg(null);
    const body = invoiceData ?? undefined;
    const res = await fetch(`/api/auftraege/${id}/rechnung`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (res.ok) {
      setInvoiceMsg({ type: "ok", text: `Rechnung ${data.invoice_number} generiert` });
      setInvoiceEdit(false);
      await reload();
    } else {
      setInvoiceMsg({ type: "err", text: data.error ?? "Fehler" });
    }
    setInvoiceLoading(null);
  }

  async function downloadInvoice() {
    const res = await fetch(`/api/auftraege/${id}/rechnung`);
    if (!res.ok) { setInvoiceMsg({ type: "err", text: "Keine Rechnung vorhanden" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="(.+?)"/);
    a.download = match ? match[1] : `Rechnung-${id}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function sendInvoice() {
    setInvoiceLoading("send");
    setInvoiceMsg(null);
    const res = await fetch(`/api/auftraege/${id}/rechnung/send`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setInvoiceMsg({ type: "ok", text: "Rechnung per E-Mail versendet" });
      await reload();
    } else {
      setInvoiceMsg({ type: "err", text: data.error ?? "Versand fehlgeschlagen" });
    }
    setInvoiceLoading(null);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;
  if (!order) return <div className="p-8 text-sm text-red-500">Auftrag nicht gefunden.</div>;

  const meta = getVenture(order.venture);
  const timelineIdx = STATUS_TIMELINE.indexOf(order.status);

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/auftraege" className="text-sm text-gray-400 hover:text-gray-600">← Aufträge</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">{order.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte — Hauptinfo */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">{order.title}</h1>
                {meta && <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${meta.color}`}>{meta.label}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
                {order.status !== "storniert" && order.status !== "abgeschlossen" && (
                  <button
                    onClick={async () => {
                      if (!confirm("Bestellung wirklich stornieren? Käufer und Verkäufer werden per E-Mail informiert.")) return;
                      setStornoSaving(true);
                      await fetch(`/api/auftraege/${id}/stornieren`, { method: "POST" });
                      await reload();
                      setStornoSaving(false);
                    }}
                    disabled={stornoSaving}
                    className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {stornoSaving ? "…" : "Stornieren"}
                  </button>
                )}
              </div>
            </div>

            {/* Status-Timeline */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-3 font-medium">Fortschritt</p>
              <div className="flex items-center gap-1">
                {STATUS_TIMELINE.map((s, idx) => {
                  const isPast = idx < timelineIdx;
                  const isCurrent = idx === timelineIdx;
                  const isFuture = idx > timelineIdx;
                  return (
                    <div key={s} className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => patch({ status: s })}
                        title={STATUS_LABELS[s]}
                        className={`w-full py-1.5 px-1 text-xs rounded font-medium truncate transition-colors ${
                          isCurrent ? (STATUS_COLORS[s] ?? "bg-blue-100 text-blue-700") :
                          isPast ? "bg-gray-100 text-gray-500 hover:bg-gray-200" :
                          "bg-white border border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-500"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                      {idx < STATUS_TIMELINE.length - 1 && (
                        <div className={`h-px w-2 shrink-0 ${isPast || isCurrent ? "bg-gray-300" : "bg-gray-100"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status-Dropdown + Save */}
            <div className="px-5 py-3 flex items-center gap-3">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {editStatus !== order.status && (
                <button
                  onClick={() => patch({ status: editStatus })}
                  disabled={saving === "status"}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving === "status" ? "..." : "Status setzen"}
                </button>
              )}
            </div>
          </div>

          {/* Auftragsdetails */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 grid grid-cols-2 gap-4 text-sm">
            <Field label="Paket" value={order.package_type} />
            <Field label="Wert" value={order.value != null ? `${order.value.toLocaleString("de-DE")} €` : null} />
            <Field label="Deadline" value={order.deadline ? new Date(order.deadline).toLocaleDateString("de-DE") : null} />
            <Field label="Erstellt" value={new Date(order.created_at).toLocaleDateString("de-DE")} />
            {order.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Beschreibung</p>
                <p className="text-gray-700 whitespace-pre-wrap">{order.description}</p>
              </div>
            )}
            {/* Notes moved to NotesField below */}
          </div>

          {/* Briefing-URL + Tracking */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projektdaten</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Briefing-URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={editBriefingUrl}
                  onChange={(e) => setEditBriefingUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editBriefingUrl !== (order.briefing_url ?? "") && (
                  <button onClick={() => patch({ briefing_url: editBriefingUrl || null })}
                    disabled={saving === "briefing_url"}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {saving === "briefing_url" ? "..." : "Speichern"}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 block">Tracking / Sendungsverfolgung</label>
              <div className="flex gap-2">
                <select
                  value={editCarrier}
                  onChange={e => setEditCarrier(e.target.value)}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 shrink-0"
                >
                  <option value="">— Carrier —</option>
                  <option value="dhl">DHL</option>
                  <option value="dpd">DPD</option>
                  <option value="ups">UPS</option>
                  <option value="gls">GLS</option>
                  <option value="hermes">Hermes</option>
                  <option value="fedex">FedEx</option>
                  <option value="dhl_express">DHL Express</option>
                  <option value="other">Sonstige</option>
                </select>
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  placeholder="Sendungsnummer"
                  className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {(editTracking !== (order.tracking_number ?? "") || editCarrier !== (order.tracking_carrier ?? "")) && (
                  <button
                    onClick={() => patch({ tracking_number: editTracking || null, tracking_carrier: editCarrier || null })}
                    disabled={saving === "tracking_number"}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                    {saving === "tracking_number" ? "..." : "Speichern"}
                  </button>
                )}
              </div>
              {order.tracking_number && order.tracking_carrier && order.tracking_carrier !== "other" && (() => {
                const urls: Record<string, string> = {
                  dhl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${order.tracking_number}`,
                  dpd: `https://tracking.dpd.de/status/de_DE/parcel/${order.tracking_number}`,
                  ups: `https://www.ups.com/track?tracknum=${order.tracking_number}&loc=de_DE`,
                  gls: `https://gls-group.eu/DE/de/paketverfolgung.html?match=${order.tracking_number}`,
                  hermes: `https://www.myhermes.de/empfangen/sendungsverfolgung/#${order.tracking_number}`,
                  fedex: `https://www.fedex.com/de-de/tracking.html?tracknumbers=${order.tracking_number}`,
                  dhl_express: `https://www.dhl.com/de-de/home/tracking.html?tracking-id=${order.tracking_number}`,
                };
                const url = urls[order.tracking_carrier];
                if (!url) return null;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Sendung bei {order.tracking_carrier.toUpperCase().replace("_EXPRESS", " Express").replace("DHL_EXPRESS", "DHL Express")} verfolgen →
                  </a>
                );
              })()}
            </div>
          </div>

          {/* Versenden-Aktion */}
          {order.status !== "versendet" && order.status !== "storniert" && order.status !== "abgeschlossen" && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Versand</p>
                <button
                  onClick={() => setShowVersenden(v => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  {showVersenden ? "Abbrechen" : "Als versendet markieren →"}
                </button>
              </div>
              {showVersenden && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Carrier</label>
                      <select
                        value={versendForm.tracking_carrier}
                        onChange={e => setVersendForm(f => ({ ...f, tracking_carrier: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">— Keiner —</option>
                        <option value="dhl">DHL</option>
                        <option value="dpd">DPD</option>
                        <option value="ups">UPS</option>
                        <option value="gls">GLS</option>
                        <option value="hermes">Hermes</option>
                        <option value="fedex">FedEx</option>
                        <option value="dhl_express">DHL Express</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Sendungsnummer</label>
                      <input
                        type="text"
                        value={versendForm.tracking_number}
                        onChange={e => setVersendForm(f => ({ ...f, tracking_number: e.target.value }))}
                        placeholder="optional"
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setVersendSaving(true);
                      await fetch(`/api/auftraege/${id}/versenden`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          tracking_number: versendForm.tracking_number || null,
                          tracking_carrier: versendForm.tracking_carrier || null,
                        }),
                      });
                      setShowVersenden(false);
                      setVersendForm({ tracking_number: "", tracking_carrier: "" });
                      await reload();
                      setVersendSaving(false);
                    }}
                    disabled={versendSaving}
                    className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {versendSaving ? "…" : "Versenden + Käufer benachrichtigen"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bestellpositionen */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bestellpositionen</p>
              <button onClick={() => setShowAddItem(v => !v)} className="text-xs text-blue-600 hover:text-blue-700">
                {showAddItem ? "Abbrechen" : "+ Position"}
              </button>
            </div>

            {showAddItem && (
              <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Artikelname *</label>
                    <input type="text" value={itemForm.product_name}
                      onChange={e => setItemForm(f => ({ ...f, product_name: e.target.value }))}
                      placeholder="z.B. T-Shirt Schwarz"
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">SKU</label>
                    <input type="text" value={itemForm.sku}
                      onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder="optional"
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Einzelpreis (€)</label>
                    <input type="number" step="0.01" min="0" value={itemForm.unit_price}
                      onChange={e => setItemForm(f => ({ ...f, unit_price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Menge</label>
                    <input type="number" min="1" value={itemForm.quantity}
                      onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notiz</label>
                    <input type="text" value={itemForm.notes}
                      onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="z.B. Größe L"
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  disabled={!itemForm.product_name.trim() || itemSaving}
                  onClick={async () => {
                    setItemSaving(true);
                    await fetch(`/api/auftraege/${id}/positionen`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        product_name: itemForm.product_name.trim(),
                        sku: itemForm.sku || null,
                        quantity: parseInt(itemForm.quantity) || 1,
                        unit_price: parseFloat(itemForm.unit_price) || 0,
                        notes: itemForm.notes || null,
                      }),
                    });
                    setItemForm({ product_name: "", sku: "", quantity: "1", unit_price: "", notes: "" });
                    setShowAddItem(false);
                    await reload();
                    setItemSaving(false);
                  }}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {itemSaving ? "…" : "Hinzufügen"}
                </button>
              </div>
            )}

            {orderItems.length === 0 && !showAddItem ? (
              <p className="text-xs text-gray-400">Noch keine Positionen erfasst.</p>
            ) : (
              <div className="space-y-0">
                {orderItems.map((item, idx) => {
                  const total = item.quantity * item.unit_price;
                  return (
                    <div key={item.id} className={`flex items-center justify-between gap-3 py-2 ${idx < orderItems.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 font-medium">{item.product_name}</p>
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                          <span>{item.quantity} × {Number(item.unit_price).toFixed(2).replace(".", ",")} €</span>
                          {item.notes && <span>— {item.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-gray-700 font-mono tabular-nums">
                          {total.toFixed(2).replace(".", ",")} €
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm("Position entfernen?")) return;
                            await fetch(`/api/auftraege/${id}/positionen`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ item_id: item.id }),
                            });
                            await reload();
                          }}
                          className="text-xs text-red-400 hover:text-red-600"
                        >×</button>
                      </div>
                    </div>
                  );
                })}
                {orderItems.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold text-gray-900">
                    <span>Gesamt</span>
                    <span className="font-mono tabular-nums">
                      {orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2).replace(".", ",")} €
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notizen */}
          <NotesField
            value={order.notes}
            onSave={async (notes) => {
              await fetch(`/api/auftraege/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
              });
            }}
          />

          {/* Anhänge */}
          <AttachmentsPanel entityType="order" entityId={id} venture={order.venture} />

          {/* Activity Feed */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium">Aktivitäten</h2>
            </div>
            {activities.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Aktivitäten</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activities.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ACTIVITY_COLORS[a.activity_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {a.activity_type}
                      </span>
                      <div>
                        {a.from_status && a.to_status && (
                          <p className="text-sm text-gray-700">
                            <span className="text-gray-400">{STATUS_LABELS[a.from_status] ?? a.from_status}</span>
                            {" → "}
                            <span className="font-medium">{STATUS_LABELS[a.to_status] ?? a.to_status}</span>
                          </p>
                        )}
                        {a.description && <p className="text-sm text-gray-600 mt-0.5">{a.description}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{fmt(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rechte Spalte — Zahlungen + Kunde */}
        <div className="space-y-5">

          {/* Zahlungsstatus */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zahlungen</p>
              {order.value != null && (
                <span className="text-xs text-gray-500">
                  {order.value.toLocaleString("de-DE")} € gesamt
                </span>
              )}
            </div>

            {/* Payment steps (if model assigned) */}
            {order.payment_steps && order.payment_steps.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const steps = order.payment_steps;
                  const paidTotal = steps.filter(s => s.paid).reduce((sum, s) => sum + (s.amount ?? 0), 0);
                  const openTotal = steps.filter(s => !s.paid).reduce((sum, s) => sum + (s.amount ?? 0), 0);
                  return (
                    <>
                      {steps.map((s) => (
                        <div key={s.step} className={`flex items-start justify-between gap-3 rounded-md px-3 py-2.5 ${s.paid ? "bg-green-50" : "bg-gray-50"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{s.label}</p>
                              <span className="text-xs text-gray-400">{s.percentage}%</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-sm font-semibold text-gray-700">
                                {(s.amount ?? 0).toLocaleString("de-DE")} €
                              </p>
                              {s.due_date && !s.paid && (
                                <p className="text-xs text-gray-400">
                                  fällig {new Date(s.due_date).toLocaleDateString("de-DE")}
                                </p>
                              )}
                              {s.paid && s.paid_at && (
                                <p className="text-xs text-green-600">
                                  ✓ {new Date(s.paid_at).toLocaleDateString("de-DE")}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{s.trigger}</p>
                          </div>
                          <button
                            onClick={() => togglePaymentStep(s.step, !s.paid)}
                            disabled={paymentModelLoading === `step-${s.step}`}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                              s.paid ? "bg-green-500" : "bg-gray-200"
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              s.paid ? "translate-x-6" : "translate-x-1"
                            }`} />
                          </button>
                        </div>
                      ))}
                      <div className="border-t border-gray-100 pt-2 flex justify-between text-xs">
                        <span className="text-green-600">Bezahlt: {paidTotal.toLocaleString("de-DE")} €</span>
                        <span className={openTotal > 0 ? "text-orange-600 font-medium" : "text-gray-400"}>
                          Offen: {openTotal.toLocaleString("de-DE")} €
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              /* No model assigned — show model selector */
              <div>
                <p className="text-xs text-gray-400 mb-3">Kein Zahlungsmodell zugewiesen.</p>
                {availableModels.length > 0 && (
                  <div className="space-y-1.5">
                    {availableModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => applyPaymentModel(m.id)}
                        disabled={paymentModelLoading === "model"}
                        className="w-full text-left text-sm px-3 py-2 border border-gray-200 rounded-md hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{m.payment_method}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Change model link (when steps exist) */}
            {order.payment_steps && order.payment_steps.length > 0 && availableModels.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">Modell wechseln:</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableModels.map((m) => (
                    <button key={m.id} onClick={() => applyPaymentModel(m.id)}
                      disabled={paymentModelLoading === "model" || m.id === order.payment_model_id}
                      className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                        m.id === order.payment_model_id
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                      }`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rechnung */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rechnung</p>
              {!invoiceEdit && (
                <button onClick={openInvoiceEditor} className="text-xs text-blue-600 hover:underline">
                  {order.invoice_number ? "Bearbeiten" : "Erstellen"}
                </button>
              )}
            </div>

            {/* Status */}
            {!invoiceEdit && order.invoice_number && (
              <div className="mb-3 text-xs text-gray-500 space-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-700">{order.invoice_number}</p>
                  {order.invoice_html && (
                    <button
                      onClick={() => setShowInvoicePreview(v => !v)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {showInvoicePreview ? "Vorschau schließen" : "Vorschau"}
                    </button>
                  )}
                </div>
                {order.invoice_generated_at && (
                  <p>Erstellt: {new Date(order.invoice_generated_at).toLocaleDateString("de-DE")}</p>
                )}
                {order.invoice_sent && <p className="text-blue-600">✓ Versendet</p>}
                {showInvoicePreview && order.invoice_html && (
                  <div className="mt-2 border border-gray-100 rounded-md overflow-hidden">
                    <iframe
                      srcDoc={order.invoice_html}
                      className="w-full"
                      style={{ height: "500px", border: "none" }}
                      sandbox="allow-same-origin"
                      title="Rechnungsvorschau"
                    />
                  </div>
                )}
              </div>
            )}

            {invoiceMsg && (
              <div className={`text-xs px-3 py-2 rounded-md mb-3 ${invoiceMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {invoiceMsg.text}
              </div>
            )}

            {/* Editor */}
            {invoiceEdit && invoiceData && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Empfänger Name</label>
                  <input type="text" value={invoiceData.recipientName}
                    onChange={e => setInvoiceData({ ...invoiceData, recipientName: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Firma</label>
                  <input type="text" value={invoiceData.recipientCompany}
                    onChange={e => setInvoiceData({ ...invoiceData, recipientCompany: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Adresse / Ort</label>
                  <input type="text" value={invoiceData.recipientAddress}
                    onChange={e => setInvoiceData({ ...invoiceData, recipientAddress: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Positionen</label>
                    <button
                      onClick={() => setInvoiceData({ ...invoiceData, positions: [...invoiceData.positions, { description: "", details: "", net: 0 }] })}
                      className="text-xs text-blue-600 hover:underline"
                    >+ Position</button>
                  </div>
                  <div className="space-y-2">
                    {invoiceData.positions.map((pos, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-md p-2 space-y-1.5 bg-gray-50">
                        <input type="text" placeholder="Bezeichnung" value={pos.description}
                          onChange={e => { const p = [...invoiceData.positions]; p[idx] = { ...p[idx], description: e.target.value }; setInvoiceData({ ...invoiceData, positions: p }); }}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        <input type="text" placeholder="Details (optional)" value={pos.details}
                          onChange={e => { const p = [...invoiceData.positions]; p[idx] = { ...p[idx], details: e.target.value }; setInvoiceData({ ...invoiceData, positions: p }); }}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                        <div className="flex items-center gap-2">
                          <input type="number" placeholder="Nettobetrag €" value={pos.net || ""}
                            onChange={e => { const p = [...invoiceData.positions]; p[idx] = { ...p[idx], net: parseFloat(e.target.value) || 0 }; setInvoiceData({ ...invoiceData, positions: p }); }}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                          {invoiceData.positions.length > 1 && (
                            <button onClick={() => { const p = invoiceData.positions.filter((_, i) => i !== idx); setInvoiceData({ ...invoiceData, positions: p }); }}
                              className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">MwSt. %</label>
                    <input type="number" value={invoiceData.taxRate}
                      onChange={e => setInvoiceData({ ...invoiceData, taxRate: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Zahlungsziel (Tage)</label>
                    <input type="number" value={invoiceData.dueDays}
                      onChange={e => setInvoiceData({ ...invoiceData, dueDays: parseInt(e.target.value) || 14 })}
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notizen / Hinweise</label>
                  <textarea value={invoiceData.notes} rows={2}
                    onChange={e => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={generateInvoice} disabled={invoiceLoading === "generate"}
                    className="flex-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {invoiceLoading === "generate" ? "Generiere..." : "Generieren"}
                  </button>
                  <button onClick={() => setInvoiceEdit(false)}
                    className="text-sm px-3 py-2 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Actions (when not editing) */}
            {!invoiceEdit && (
              <div className="space-y-2">
                {!order.invoice_number && (
                  <button onClick={openInvoiceEditor}
                    className="w-full text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    Rechnung erstellen
                  </button>
                )}
                {order.invoice_number && (
                  <>
                    <button onClick={downloadInvoice}
                      className="w-full text-sm px-3 py-2 border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                      Herunterladen
                    </button>
                    <button onClick={sendInvoice} disabled={invoiceLoading === "send" || !order.customer?.email}
                      className="w-full text-sm px-3 py-2 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50 transition-colors">
                      {invoiceLoading === "send" ? "Sende..." : "Per E-Mail senden"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Kunde */}
          {order.customer && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Kunde</p>
              <p className="text-sm font-medium">{order.customer.first_name} {order.customer.last_name}</p>
              {order.customer.company_name && <p className="text-xs text-gray-500">{order.customer.company_name}</p>}
              {order.customer.email && (
                <a href={`mailto:${order.customer.email}`} className="text-xs text-blue-600 hover:underline block mt-1">
                  {order.customer.email}
                </a>
              )}
              {order.customer.phone && <p className="text-xs text-gray-500 mt-0.5">{order.customer.phone}</p>}
              {order.customer.city && <p className="text-xs text-gray-400 mt-0.5">{order.customer.city}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-gray-700">{value ?? "—"}</p>
    </div>
  );
}
