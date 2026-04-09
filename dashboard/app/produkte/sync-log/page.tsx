"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";
import Link from "next/link";

interface SyncLog {
  id: string;
  product_id: string;
  venture: string;
  action: string;
  status: "pending" | "processing" | "success" | "error";
  wc_product_id: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  product: { id: string; name: string; slug: string | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  processing: "Läuft…",
  success: "Erfolg",
  error: "Fehler",
};
const ACTION_LABELS: Record<string, string> = {
  create: "Erstellt",
  update: "Aktualisiert",
};

export default function SyncLogPage() {
  const { venture } = useVenture();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/produkte/sync-log?venture=${venture}&limit=100`).then(r => r.json());
    setLogs(Array.isArray(data.logs) ? data.logs : []);
    setLoading(false);
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  async function retrigger(productId: string) {
    setSyncing(productId);
    await fetch("/api/produkte/sync-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    await load();
    setSyncing(null);
  }

  const filtered = statusFilter === "all"
    ? logs
    : logs.filter(l => l.status === statusFilter);

  const statusCounts = {
    all: logs.length,
    success: logs.filter(l => l.status === "success").length,
    error: logs.filter(l => l.status === "error").length,
    pending: logs.filter(l => l.status === "pending" || l.status === "processing").length,
  };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/produkte" className="text-sm text-gray-400 hover:text-gray-600">← Produkte</Link>
          </div>
          <h1 className="text-xl font-semibold text-[#14193A]">Storefront Sync-Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            WooCommerce Synchronisation · {venture.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          ↺ Aktualisieren
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-5 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Wie funktioniert der Sync?</p>
        <ul className="list-disc list-inside text-blue-600 space-y-0.5">
          <li>Produkte werden per DB-Webhook automatisch synchronisiert wenn <code className="bg-blue-100 px-1 rounded">sync_status = &apos;pending&apos;</code></li>
          <li>WooCommerce-Zugangsdaten in <Link href="/einstellungen" className="underline">Einstellungen</Link> hinterlegen: <code className="bg-blue-100 px-1 rounded">shop_url</code>, <code className="bg-blue-100 px-1 rounded">wc_consumer_key</code>, <code className="bg-blue-100 px-1 rounded">wc_consumer_secret</code></li>
          <li>Bei Fehlern: Produkt über das ↺ Symbol neu synchronisieren</li>
        </ul>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: "all", label: `Alle (${statusCounts.all})` },
          { key: "success", label: `Erfolg (${statusCounts.success})` },
          { key: "error", label: `Fehler (${statusCounts.error})` },
          { key: "pending", label: `Ausstehend (${statusCounts.pending})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === tab.key
                ? "bg-[#1B2A5E] text-white border-[#1B2A5E]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-3">🔄</div>
            <p className="text-sm text-gray-500">Keine Sync-Einträge</p>
            <p className="text-xs text-gray-400 mt-1">Wenn Produkte synchronisiert werden, erscheinen sie hier.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "640px" }}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Produkt</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Aktion</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">WC-ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Zeitpunkt</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {log.product ? (
                        <Link href={`/produkte/${log.product.id}`}
                          className="text-[#1B2A5E] hover:underline font-medium">
                          {log.product.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 font-mono text-xs">{log.product_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[log.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[log.status] ?? log.status}
                        </span>
                        {log.status === "error" && log.error_message && (
                          <p className="text-[11px] text-red-500 mt-0.5 max-w-xs truncate" title={log.error_message}>
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {log.wc_product_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div>{new Date(log.created_at).toLocaleDateString("de-DE")}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td className="px-4 py-3">
                      {(log.status === "error" || log.status === "pending") && log.product && (
                        <button
                          onClick={() => retrigger(log.product_id)}
                          disabled={syncing === log.product_id}
                          title="Erneut synchronisieren"
                          className="text-xs text-gray-400 hover:text-[#1B2A5E] disabled:opacity-40 p-1 rounded hover:bg-gray-100"
                        >
                          {syncing === log.product_id ? "…" : "↺"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
