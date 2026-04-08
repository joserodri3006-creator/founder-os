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
  anzahlung_betrag: number | null;
  anzahlung_erhalten: boolean;
  restzahlung_erhalten: boolean;
  invoice_sent: boolean;
  invoice_number: string | null;
  invoice_generated_at: string | null;
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
  briefing: "Briefing",
  in_bearbeitung: "In Bearbeitung",
  in_produktion: "In Produktion",
  review: "Review / Abnahme",
  abgeschlossen: "Abgeschlossen",
  nachbetreuung: "Nachbetreuung",
  storniert: "Storniert",
  pausiert: "Pausiert",
  angebot_gesendet: "Angebot gesendet",
};

const STATUS_COLORS: Record<string, string> = {
  neu: "bg-blue-100 text-blue-700",
  briefing: "bg-cyan-100 text-cyan-700",
  in_bearbeitung: "bg-yellow-100 text-yellow-700",
  in_produktion: "bg-orange-100 text-orange-700",
  review: "bg-purple-100 text-purple-700",
  abgeschlossen: "bg-green-100 text-green-700",
  nachbetreuung: "bg-teal-100 text-teal-700",
  storniert: "bg-red-100 text-red-700",
  pausiert: "bg-gray-100 text-gray-600",
  angebot_gesendet: "bg-indigo-100 text-indigo-700",
};

// Visuelle Reihenfolge der Status-Timeline
const STATUS_TIMELINE = ["neu", "briefing", "in_bearbeitung", "in_produktion", "review", "abgeschlossen", "nachbetreuung"];

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
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [invoiceMsg, setInvoiceMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [invoiceEdit, setInvoiceEdit] = useState(false);
  const [availableModels, setAvailableModels] = useState<PaymentModel[]>([]);
  const [paymentModelLoading, setPaymentModelLoading] = useState<string | null>(null);
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
    const [o, a] = await Promise.all([
      fetch(`/api/auftraege/${id}`).then(r => r.json()),
      fetch(`/api/auftraege/${id}/activities`).then(r => r.json()),
    ]);
    setOrder(o);
    setEditStatus(o.status);
    setEditBriefingUrl(o.briefing_url ?? "");
    setEditTracking(o.tracking_number ?? "");
    setActivities(Array.isArray(a) ? a : []);
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
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
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
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tracking-Nummer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  placeholder="z.B. DHL / Sendungsnummer"
                  className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editTracking !== (order.tracking_number ?? "") && (
                  <button onClick={() => patch({ tracking_number: editTracking || null })}
                    disabled={saving === "tracking_number"}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {saving === "tracking_number" ? "..." : "Speichern"}
                  </button>
                )}
              </div>
            </div>
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
                <p className="font-medium text-gray-700">{order.invoice_number}</p>
                {order.invoice_generated_at && (
                  <p>Erstellt: {new Date(order.invoice_generated_at).toLocaleDateString("de-DE")}</p>
                )}
                {order.invoice_sent && <p className="text-blue-600">✓ Versendet</p>}
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
