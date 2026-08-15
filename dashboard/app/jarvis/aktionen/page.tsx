"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface AutonomousAction {
  id: string;
  venture: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  action_payload: { subject?: string; body?: string };
  reason: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  result: { sent?: boolean; error?: string } | null;
  created_at: string;
  resolved_at: string | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  send_followup_email: "Follow-up-Mail",
};

const STATUS_LABELS: Record<AutonomousAction["status"], string> = {
  pending: "Wartet auf Bestätigung",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  executed: "Ausgeführt",
  failed: "Fehlgeschlagen",
};
const STATUS_COLORS: Record<AutonomousAction["status"], { bg: string; color: string }> = {
  pending: { bg: "#FEF9C3", color: "#A16207" },
  approved: { bg: "#DBEAFE", color: "#1D4ED8" },
  rejected: { bg: "#F3F4F6", color: "#4B5563" },
  executed: { bg: "#D1FAE5", color: "#047857" },
  failed: { bg: "#FEE2E2", color: "#B91C1C" },
};

export default function JarvisAktionenPage() {
  const { user, loading: authLoading } = useAuth();
  const [actions, setActions] = useState<AutonomousAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "alle">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "alle") params.set("status", status);
    const res = await fetch(`/api/jarvis/aktionen?${params}`);
    const data = await res.json();
    setActions(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "founder") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status]);

  async function decide(id: string, approved: boolean) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/jarvis/aktionen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Aktion fehlgeschlagen");
    }
    load();
  }

  if (authLoading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  if (user && user.role !== "founder") {
    return (
      <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-6 text-sm text-gray-600">
          Jarvis-Aktionen stehen aktuell nur dem Founder zur Verfügung.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Jarvis-Aktionen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Vorschläge aus dem täglichen autonomen Check — abseits vom laufenden Chat
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "pending" | "alle")}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="pending">Wartet auf Bestätigung</option>
          <option value="alle">Alle</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : actions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Keine Aktionen gefunden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            const sc = STATUS_COLORS[action.status];
            return (
              <div key={action.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>
                    {STATUS_LABELS[action.status]}
                  </span>
                  <span className="text-gray-500">{ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}</span>
                  <span className="text-gray-400">· {action.venture}</span>
                  <span className="text-gray-400">· {new Date(action.created_at).toLocaleString("de-DE")}</span>
                </div>

                <p className="text-sm text-gray-800 mb-1.5">{action.reason}</p>

                {action.action_payload.subject && (
                  <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2 text-xs text-gray-600 mb-2">
                    <div className="font-medium text-gray-700 mb-0.5">Betreff: {action.action_payload.subject}</div>
                    <div className="whitespace-pre-wrap">{action.action_payload.body}</div>
                  </div>
                )}

                {action.result?.error && (
                  <p className="text-xs text-red-600 mb-2">Fehler: {action.result.error}</p>
                )}

                {action.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(action.id, true)}
                      disabled={busyId === action.id}
                      className="text-xs px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-40"
                      style={{ background: "#1B2A5E" }}
                    >
                      Genehmigen &amp; ausführen
                    </button>
                    <button
                      onClick={() => decide(action.id, false)}
                      disabled={busyId === action.id}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Ablehnen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
