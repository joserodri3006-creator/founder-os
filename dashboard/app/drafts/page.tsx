"use client";

import { useEffect, useState } from "react";
import { Lead } from "@/lib/types";
import { useVenture } from "@/context/VentureContext";

function extractScore(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Score:\s*(\d+)\/5/);
  return match ? match[1] : null;
}

async function apiPost(path: string, body: object): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function DraftsPage() {
  const { venture } = useVenture();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/drafts?venture=${venture}`)
      .then((r) => r.json())
      .then((list: Lead[]) => {
        setLeads(list);
        const initial: Record<string, { subject: string; body: string }> = {};
        list.forEach((l) => { initial[l.id] = { subject: l.ai_draft_subject ?? "", body: l.ai_draft_body ?? "" }; });
        setEditing(initial);
        setLoading(false);
      });
  }, [venture]);

  function setEdit(id: string, field: "subject" | "body", value: string) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSave(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    const { ok } = await apiPost("/api/drafts/save", { lead_id: id, subject: editing[id].subject, body: editing[id].body });
    setFeedback((f) => ({ ...f, [id]: ok ? "Gespeichert" : "Fehler beim Speichern" }));
    setTimeout(() => setFeedback((f) => ({ ...f, [id]: "" })), 2000);
    setBusy((b) => ({ ...b, [id]: false }));
  }

  async function handleSend(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    const { ok, data } = await apiPost("/api/drafts/send", { lead_id: id, subject: editing[id].subject, body: editing[id].body });
    if (ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } else {
      const msg = (data as { error?: string })?.error ?? "Fehler beim Senden";
      setFeedback((f) => ({ ...f, [id]: msg }));
      setTimeout(() => setFeedback((f) => ({ ...f, [id]: "" })), 3000);
    }
    setBusy((b) => ({ ...b, [id]: false }));
  }

  async function handleDiscard(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    const { ok } = await apiPost("/api/drafts/discard", { lead_id: id });
    if (ok) setLeads((prev) => prev.filter((l) => l.id !== id));
    else setFeedback((f) => ({ ...f, [id]: "Fehler beim Verwerfen" }));
    setBusy((b) => ({ ...b, [id]: false }));
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">KI-Drafts</h1>
        <span className="text-sm text-gray-400">{leads.length} offen</span>
      </div>

      {leads.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-8 py-16 text-center text-gray-400">
          Keine offenen Drafts
        </div>
      )}

      <div className="space-y-5">
        {leads.map((lead) => {
          const score = extractScore(lead.notes);
          const e = editing[lead.id] ?? { subject: "", body: "" };
          const isBusy = busy[lead.id] ?? false;
          const fb = feedback[lead.id];

          return (
            <div key={lead.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-medium">{lead.first_name} {lead.last_name}</span>
                  {lead.company_name && <span className="text-gray-500 ml-2">· {lead.company_name}</span>}
                  <span className="text-gray-400 text-sm ml-2">· {lead.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  {lead.industry && <span className="text-xs text-gray-400">{lead.industry}</span>}
                  {score && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      Number(score) >= 4 ? "bg-green-100 text-green-700" :
                      Number(score) >= 3 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>Score {score}/5</span>
                  )}
                  <span className="text-xs text-gray-300">{new Date(lead.created_at).toLocaleDateString("de-DE")}</span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Betreff</label>
                  <input
                    type="text"
                    value={e.subject}
                    onChange={(ev) => setEdit(lead.id, "subject", ev.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">E-Mail-Text</label>
                  <textarea
                    value={e.body}
                    onChange={(ev) => setEdit(lead.id, "body", ev.target.value)}
                    rows={12}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y font-mono"
                  />
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                <button onClick={() => handleSend(lead.id)} disabled={isBusy}
                  className="text-sm px-4 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                  Freigeben & Senden
                </button>
                <button onClick={() => handleSave(lead.id)} disabled={isBusy}
                  className="text-sm px-4 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  Speichern
                </button>
                {fb && <span className={`text-xs ${fb.includes("Fehler") ? "text-red-500" : "text-green-600"}`}>{fb}</span>}
                <button onClick={() => handleDiscard(lead.id)} disabled={isBusy}
                  className="text-sm px-4 py-1.5 text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors ml-auto">
                  Verwerfen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
