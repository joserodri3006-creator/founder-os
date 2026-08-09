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
  notes: string | null;
  requested_at: string;
  processed_at: string | null;
  order: { id: string; title: string; invoice_number: string | null; value: number | null } | null;
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
  const [refundForm, setRefundForm] = useState({ amount: "", method: "", notes: "" });

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
    await fetch(`/api/retouren/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setActiveId(null);
    setRefundForm({ amount: "", method: "", notes: "" });
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
                            · {item.name ?? item.product_name ?? "Artikel"}{item.quantity ? ` × ${item.quantity}` : ""}
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
                    {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.status === "requested" && (
                      <>
                        <button
                          onClick={() => setActiveId(activeId === r.id ? null : r.id)}
                          disabled={!!processing}
                          className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Genehmigen
                        </button>
                        <button
                          onClick={() => act(r.id, "reject")}
                          disabled={!!processing}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {processing === r.id + "reject" ? "…" : "Ablehnen"}
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        onClick={() => setActiveId(activeId === r.id ? null : r.id)}
                        disabled={!!processing}
                        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Abschließen
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline action form */}
                {activeId === r.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {r.status === "requested" ? "Genehmigung" : "Abschließen"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Rückerstattung (€)</label>
                        <input type="number" step="0.01" min="0"
                          value={refundForm.amount}
                          onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder={r.order?.value ? String(r.order.value) : "0.00"}
                          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Methode</label>
                        <select
                          value={refundForm.method}
                          onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}
                          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">— Wählen —</option>
                          <option value="PayPal">PayPal</option>
                          <option value="Überweisung">Überweisung</option>
                          <option value="Gutschein">Gutschein</option>
                          <option value="Stripe">Stripe</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Interne Notiz</label>
                      <input type="text"
                        value={refundForm.notes}
                        onChange={e => setRefundForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Für Kunden nicht sichtbar"
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => act(r.id, r.status === "requested" ? "approve" : "complete", {
                          refund_amount: refundForm.amount ? parseFloat(refundForm.amount) : null,
                          refund_method: refundForm.method || null,
                          notes: refundForm.notes || null,
                        })}
                        disabled={!!processing}
                        className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processing ? "…" : r.status === "requested" ? "Genehmigen + E-Mail" : "Abschließen + E-Mail"}
                      </button>
                      <button onClick={() => setActiveId(null)} className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700">
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
