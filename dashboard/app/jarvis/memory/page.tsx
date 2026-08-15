"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface MemoryEntry {
  id: string;
  venture: string | null;
  memory_type: "personal" | "venture" | "knowledge";
  content: string;
  source: "explicit" | "extracted" | "research";
  source_ref: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<MemoryEntry["memory_type"], string> = {
  personal: "Persönlich",
  venture: "Venture",
  knowledge: "Wissen",
};
const TYPE_COLORS: Record<MemoryEntry["memory_type"], { bg: string; color: string }> = {
  personal: { bg: "#EDE9FE", color: "#6D28D9" },
  venture: { bg: "#DBEAFE", color: "#1D4ED8" },
  knowledge: { bg: "#D1FAE5", color: "#047857" },
};
const SOURCE_LABELS: Record<MemoryEntry["source"], string> = {
  explicit: "Explizit gesagt",
  extracted: "Automatisch erkannt",
  research: "Recherche",
};

export default function JarvisMemoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"alle" | MemoryEntry["memory_type"]>("alle");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== "alle") params.set("type", type);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/jarvis/memory?${params}`);
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "founder") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, type]);

  function startEdit(entry: MemoryEntry) {
    setEditingId(entry.id);
    setEditValue(entry.content);
  }

  async function saveEdit(id: string) {
    if (!editValue.trim() || saving) return;
    setSaving(true);
    const res = await fetch("/api/jarvis/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: editValue.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/jarvis/memory?id=${id}`, { method: "DELETE" });
  }

  if (authLoading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  if (user && user.role !== "founder") {
    return (
      <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-6 text-sm text-gray-600">
          Jarvis-Gedächtnis steht aktuell nur dem Founder zur Verfügung.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Jarvis-Gedächtnis</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Was Jarvis sich dauerhaft merkt — einsehbar, editierbar, löschbar
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "alle" | MemoryEntry["memory_type"])}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="alle">Alle Typen</option>
          {(Object.keys(TYPE_LABELS) as MemoryEntry["memory_type"][]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          placeholder="Volltextsuche…"
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white flex-1 min-w-[180px]"
        />
        <button
          onClick={load}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Suchen
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Noch nichts gespeichert.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const tc = TYPE_COLORS[entry.memory_type];
            const isEditing = editingId === entry.id;
            return (
              <div key={entry.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: tc.bg, color: tc.color }}>
                    {TYPE_LABELS[entry.memory_type]}
                  </span>
                  {entry.venture && <span className="text-gray-500">{entry.venture}</span>}
                  <span className="text-gray-400">· {SOURCE_LABELS[entry.source]}</span>
                  <span className="text-gray-400">· {new Date(entry.updated_at).toLocaleDateString("de-DE")}</span>
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => saveEdit(entry.id)}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-40"
                        style={{ background: "#1B2A5E" }}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-800 flex-1">{entry.content}</p>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(entry)} className="text-xs text-gray-400 hover:text-gray-700">
                        Bearbeiten
                      </button>
                      <button onClick={() => deleteEntry(entry.id)} className="text-xs text-gray-400 hover:text-red-600">
                        Löschen
                      </button>
                    </div>
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
