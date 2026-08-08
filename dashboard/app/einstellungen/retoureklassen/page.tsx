"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";

interface ReturnClass {
  id: string;
  name: string;
  description?: string;
  cost: number;
  is_default: boolean;
  venture: string;
  created_at: string;
}

export default function RetoureklassenPage() {
  const { venture } = useVenture();
  const [classes, setClasses] = useState<ReturnClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCost, setNewCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCost, setEditCost] = useState("0");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/retoureklassen?venture=${venture}`)
      .then(r => r.json())
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/retoureklassen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim() || null,
        cost: parseFloat(newCost) || 0,
        venture,
        is_default: classes.length === 0,
      }),
    });
    setNewName(""); setNewDesc(""); setNewCost("0");
    setShowNew(false);
    setSaving(false);
    load();
  }

  async function update(id: string) {
    setSaving(true);
    await fetch(`/api/retoureklassen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim() || null,
        cost: parseFloat(editCost) || 0,
      }),
    });
    setEditId(null);
    setSaving(false);
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Retoureklasse "${name}" wirklich löschen? Produkte verlieren die Zuordnung.`)) return;
    await fetch(`/api/retoureklassen/${id}`, { method: "DELETE" });
    load();
  }

  async function setDefault(id: string) {
    await Promise.all(
      classes.map(c =>
        fetch(`/api/retoureklassen/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_default: c.id === id }),
        })
      )
    );
    load();
  }

  function startEdit(c: ReturnClass) {
    setEditId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
    setEditCost(String(c.cost));
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retoureklassen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Retourekosten pro Klasse · {venture.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="text-sm px-4 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14224D] transition-colors"
        >
          + Neue Klasse
        </button>
      </div>

      {/* Erklärungs-Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Wie funktionieren Retoureklassen?</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Jedes Produkt kann einer Retoureklasse zugewiesen werden</li>
          <li>Bei Retouren werden die Kosten automatisch angezeigt</li>
          <li>Kunden sehen die Retourekosten vor der Beantragung</li>
          <li>Beispiele: „Kostenlos", „Käufer trägt Porto (4,99 €)", „Sperrgut (19,90 €)"</li>
        </ul>
      </div>

      {/* Neue Klasse */}
      {showNew && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Neue Retoureklasse</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Name *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="z.B. Kostenlose Retoure"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Retourekosten (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newCost}
                onChange={e => setNewCost(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Beschreibung (optional)</label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Interne Notiz"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={saving || !newName.trim()}
              className="text-sm px-4 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14224D] disabled:opacity-50"
            >
              {saving ? "Wird gespeichert…" : "Speichern"}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Klassenlist */}
      {loading ? (
        <p className="text-sm text-gray-400">Laden…</p>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center">
          <p className="text-sm text-gray-500">Noch keine Retoureklassen</p>
          <p className="text-xs text-gray-400 mt-1">Klasse anlegen um Retourekosten zu definieren</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map(c => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              {editId === c.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Name</label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Retourekosten (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editCost}
                        onChange={e => setEditCost(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => update(c.id)}
                      disabled={saving}
                      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "…" : "Speichern"}
                    </button>
                    <button onClick={() => setEditId(null)} className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1B2A5E] text-white font-bold uppercase">
                          Standard
                        </span>
                      )}
                    </div>
                    {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                    <p className="text-sm font-semibold mt-1" style={{ color: c.cost === 0 ? "#16A34A" : "#D97706" }}>
                      {c.cost === 0 ? "Kostenlos" : `${Number(c.cost).toFixed(2).replace(".", ",")} €`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!c.is_default && (
                      <button
                        onClick={() => setDefault(c.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >
                        Als Standard
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => remove(c.id, c.name)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
