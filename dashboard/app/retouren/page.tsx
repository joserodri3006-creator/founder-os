"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface Return {
  id: string;
  venture: string;
  status: "requested" | "approved" | "rejected" | "completed";
  reason: string | null;
  items: any[] | null;
  customer_email: string | null;
  customer_name: string | null;
  refund_amount: number | null;
  refund_method: string | null;
  refund_gross_amount: number | null;
  return_shipping_cost: number | null;
  return_label_url: string | null;
  credit_note_number: string | null;
  notes: string | null;
  requested_at: string;
  processed_at: string | null;
  order: { id: string; title: string; invoice_number: string | null; value: number | null } | null;
  events?: { id: string; event_type: string; message: string | null; created_at: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  requested: "Angefragt",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  completed: "Abgeschlossen",
};
const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RetourenPage() {
  const { venture } = useVenture();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "complete" | null>(null);
  const [refundForm, setRefundForm] = useState({ amount: "", method: "", notes: "", gross: "", returnCost: "", subject: "", text: "", labelUrl: "" });
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [restoreStock, setRestoreStock] = useState(true);

  function itemLabel(r: Return) {
    return (r.items ?? []).map((item: any) => `• ${item.name ?? item.product_name ?? "Artikel"} (${item.qty ?? item.quantity ?? 1}x)`).join("\n");
  }

  function openAction(r: Return, action: "approve" | "reject" | "complete") {
    const name = r.customer_name ?? "Kundin/Kunde";
    const orderRef = r.order?.invoice_number ?? r.order?.title ?? r.id.slice(0, 8).toUpperCase();
    const items = itemLabel(r);
    const defaultSubject = action === "approve"
      ? `Ihre Retoure wurde genehmigt — ${orderRef}`
      : action === "reject"
      ? `Zu Ihrer Rückgabeanfrage — ${orderRef}`
      : `Ihre Retoure ist abgeschlossen — ${orderRef}`;
    const defaultText = action === "approve"
      ? `Hallo ${name},\n\nIhre Rückgabeanfrage zur Bestellung ${orderRef} wurde genehmigt.\n\nBitte senden Sie folgende Artikel an uns zurück:\n${items}\n\nDen Retoureschein finden Sie im Anhang bzw. über den angegebenen Link. Nach Wareneingang prüfen wir die Artikel und veranlassen die Erstattung. Die Rücksendekosten werden vom Erstattungsbetrag abgezogen.\n\nViele Grüße\nIhr iTABA Team`
      : action === "reject"
      ? `Hallo ${name},\n\nleider können wir Ihre Rückgabeanfrage zur Bestellung ${orderRef} nicht genehmigen.\n\nGrund: ${r.reason ?? "bitte hier Begründung ergänzen"}\n\nBei Fragen antworten Sie gerne auf diese E-Mail.\n\nViele Grüße\nIhr iTABA Team`
      : `Hallo ${name},\n\nIhre Retoure zur Bestellung ${orderRef} ist abgeschlossen.\n\nDie Erstattung wird nun über die angegebene Zahlungsmethode veranlasst.\n\nViele Grüße\nIhr iTABA Team`;
    setActiveId(r.id);
    setActiveAction(action);
    setRefundForm({
      amount: r.refund_amount != null ? String(r.refund_amount) : "",
      method: r.refund_method ?? "",
      notes: r.notes ?? "",
      gross: r.refund_gross_amount != null ? String(r.refund_gross_amount) : (r.order?.value != null ? String(r.order.value) : ""),
      returnCost: r.return_shipping_cost != null ? String(r.return_shipping_cost) : "",
      subject: defaultSubject,
      text: defaultText,
      labelUrl: r.return_label_url ?? "",
    });
    setLabelFile(null);
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (statusFilter !== "alle") params.set("status", statusFilter);
    const data = await fetch(`/api/retouren?${params}`).then(r => r.json());
    setReturns(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, statusFilter]);

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setProcessing(id + action);
    let labelAttachmentId: string | null = null;
    const currentReturn = returns.find(r => r.id === id);
    if (labelFile && currentReturn) {
      const formData = new FormData();
      formData.set("file", labelFile);
      formData.set("entity_type", "return_label");
      formData.set("entity_id", id);
      formData.set("description", "Retoureschein");
      formData.set("venture", currentReturn.venture);
      const uploadRes = await fetch("/api/attachments", { method: "POST", body: formData });
      const uploadBody = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        alert(uploadBody.error ?? "Retoureschein konnte nicht hochgeladen werden.");
        setProcessing(null);
        return;
      }
      labelAttachmentId = uploadBody.id;
    }
    const response = await fetch(`/api/retouren/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, return_label_attachment_id: labelAttachmentId, ...extra }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body.error ?? "Retoure konnte nicht aktualisiert werden.");
      setProcessing(null);
      return;
    }
    setActiveId(null);
    setActiveAction(null);
    setRefundForm({ amount: "", method: "", notes: "", gross: "", returnCost: "", subject: "", text: "", labelUrl: "" });
    setLabelFile(null);
    setRestoreStock(true);
    await load();
    setProcessing(null);
  }

  const pending = returns.filter(r => r.status === "requested").length;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Retouren</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rückgabeanfragen von Kunden verwalten</p>
        </div>
        {pending > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
            {pending} offen
          </span>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["alle", "requested", "approved", "rejected", "completed"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-[#14193A] text-white border-[#14193A]"
                : "text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {s === "alle" ? "Alle" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8">Laden…</p>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-12 text-center">
          <p className="text-sm text-gray-400">Keine Retouren gefunden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map(r => (
            <div key={r.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="text-xs text-gray-400">{fmt(r.requested_at)}</span>
                      {r.processed_at && (
                        <span className="text-xs text-gray-400">→ bearbeitet {fmt(r.processed_at)}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1.5">
                      {r.customer_name ?? "Unbekannt"}{r.customer_email && ` · ${r.customer_email}`}
                    </p>
                    {r.order && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Bestellung:{" "}
                        <Link href={`/auftraege/${r.order.id}`} className="text-blue-500 hover:underline">
                          {r.order.invoice_number ?? r.order.title}
                        </Link>
                        {r.order.value != null && ` · ${r.order.value.toLocaleString("de-DE")} €`}
                      </p>
                    )}
                    {r.reason && (
                      <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded px-2 py-1">{r.reason}</p>
                    )}
                    {r.items && r.items.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {r.items.map((item: any, i: number) => (
                          <p key={i} className="text-xs text-gray-500">
                            · {item.name ?? item.product_name ?? "Artikel"}{(item.qty ?? item.quantity) ? ` × ${item.qty ?? item.quantity}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                    {r.refund_amount != null && (
                      <p className="text-xs text-green-700 mt-1.5 font-medium">
                        Rückerstattung: {Number(r.refund_amount).toFixed(2).replace(".", ",")} €
                        {r.refund_method && ` via ${r.refund_method}`}
                      </p>
                    )}
                    {r.credit_note_number && (
                      <p className="text-xs text-gray-500 mt-1">Gutschrift (Buchhaltung): {r.credit_note_number}</p>
                    )}
                    {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                    {r.events && r.events.length > 0 && (
                      <div className="mt-2 rounded bg-gray-50 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-1">Protokoll</p>
                        {r.events.slice(0, 4).map(event => (
                          <p key={event.id} className="text-[11px] text-gray-500">
                            {fmt(event.created_at)} · {event.message ?? event.event_type}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.status === "requested" && (
                      <>
                        <button
                          onClick={() => openAction(r, "approve")}
                          disabled={!!processing}
                          className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Genehmigen
                        </button>
                        <button
                          onClick={() => openAction(r, "reject")}
                          disabled={!!processing}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {processing === r.id + "reject" ? "…" : "Ablehnen"}
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        onClick={() => openAction(r, "complete")}
                        disabled={!!processing}
                        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Abschließen
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline action form */}
                {activeId === r.id && activeAction && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {activeAction === "approve" ? "Genehmigen + Retoureschein senden" : activeAction === "reject" ? "Ablehnungsmail bearbeiten" : "Abschließen + Erstattung dokumentieren"}
                    </p>

                    {activeAction !== "reject" && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Warenwert (€)</label>
                          <input type="number" step="0.01" min="0"
                            value={refundForm.gross}
                            onChange={e => setRefundForm(f => ({ ...f, gross: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Retourekosten (€)</label>
                          <input type="number" step="0.01" min="0"
                            value={refundForm.returnCost}
                            onChange={e => {
                              const gross = parseFloat(refundForm.gross || "0") || 0;
                              const cost = parseFloat(e.target.value || "0") || 0;
                              setRefundForm(f => ({ ...f, returnCost: e.target.value, amount: Math.max(0, gross - cost).toFixed(2) }));
                            }}
                            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Erstattung (€)</label>
                          <input type="number" step="0.01" min="0"
                            value={refundForm.amount}
                            onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {activeAction !== "reject" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Erstattungsmethode</label>
                          <select
                            value={refundForm.method}
                            onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">— Wählen —</option>
                            <option value="PayPal">PayPal</option>
                            <option value="Überweisung">Überweisung</option>
                            <option value="Gutschein">Gutschein</option>
                          </select>
                        </div>
                        {activeAction === "approve" && (
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Retoureschein PDF</label>
                            <input type="file" accept="application/pdf,image/*" onChange={e => setLabelFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
                          </div>
                        )}
                      </div>
                    )}

                    {activeAction === "approve" && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Retoureschein-Link (optional)</label>
                        <input type="url"
                          value={refundForm.labelUrl}
                          onChange={e => setRefundForm(f => ({ ...f, labelUrl: e.target.value }))}
                          placeholder="https://..."
                          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Betreff an Kunde</label>
                      <input type="text"
                        value={refundForm.subject}
                        onChange={e => setRefundForm(f => ({ ...f, subject: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">E-Mail an Kunde (bearbeitbar)</label>
                      <textarea
                        rows={8}
                        value={refundForm.text}
                        onChange={e => setRefundForm(f => ({ ...f, text: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Interne Notiz / Protokoll</label>
                      <input type="text"
                        value={refundForm.notes}
                        onChange={e => setRefundForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Für Kunden nicht sichtbar"
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {activeAction === "complete" && (
                      <label className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-900">
                        <input type="checkbox" checked={restoreStock} onChange={e => setRestoreStock(e.target.checked)} className="mt-0.5" />
                        <span>
                          <span className="font-medium">Verkaufsfähige Artikel zurück ins Lager buchen</span>
                          <span className="block text-blue-700 mt-0.5">Nur aktiv lassen, wenn die retournierte Ware geprüft und wieder verkaufsfähig ist.</span>
                        </span>
                      </label>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => act(r.id, activeAction, {
                          refund_gross_amount: refundForm.gross ? parseFloat(refundForm.gross) : null,
                          return_shipping_cost: refundForm.returnCost ? parseFloat(refundForm.returnCost) : null,
                          refund_amount: refundForm.amount ? parseFloat(refundForm.amount) : null,
                          refund_method: refundForm.method || null,
                          notes: refundForm.notes || null,
                          customer_subject: refundForm.subject,
                          customer_text: refundForm.text,
                          return_label_url: refundForm.labelUrl || null,
                          restore_stock: activeAction === "complete" ? restoreStock : false,
                        })}
                        disabled={!!processing}
                        className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processing ? "…" : activeAction === "approve" ? "Genehmigen + E-Mail senden" : activeAction === "reject" ? "Ablehnen + E-Mail senden" : "Abschließen + E-Mail senden"}
                      </button>
                      <button onClick={() => { setActiveId(null); setActiveAction(null); }} className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
