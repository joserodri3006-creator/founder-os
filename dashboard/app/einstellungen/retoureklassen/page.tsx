"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";

interface ReturnClass {
  id: string;
  name: string;
  description?: string;
  cost: number;
  max_weight: number | null; // Gramm; null = oberste/unbegrenzte Stufe
  venture: string;
  created_at: string;
}

function sortByWeight(classes: ReturnClass[]) {
  return [...classes].sort((a, b) => {
    const aw = a.max_weight ?? Infinity;
    const bw = b.max_weight ?? Infinity;
    return aw - bw;
  });
}

export default function RetoureklassenPage() {
  const { venture } = useVenture();
  const [classes, setClasses] = useState<ReturnClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCost, setNewCost] = useState("0");
  const [newMaxWeight, setNewMaxWeight] = useState(""); // kg, leer = unbegrenzt
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCost, setEditCost] = useState("0");
  const [editMaxWeight, setEditMaxWeight] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/retoureklassen?venture=${venture}`)
      .then(r => r.json())
      .then(data => setClasses(sortByWeight(Array.isArray(data) ? data : [])))
      .finally(() => setLoading(false));
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  function parseMaxWeightKg(value: string): number | null {
    if (!value.trim()) return null; // unbegrenzt
    const kg = parseFloat(value.replace(",", "."));
    return Number.isFinite(kg) ? Math.round(kg * 1000) : null;
  }

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
        max_weight: parseMaxWeightKg(newMaxWeight),
        venture,
      }),
    });
    setNewName(""); setNewDesc(""); setNewCost("0"); setNewMaxWeight("");
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
        max_weight: parseMaxWeightKg(editMaxWeight),
      }),
    });
    setEditId(null);
    setSaving(false);
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Gewichtsstufe "${name}" wirklich löschen?`)) return;
    await fetch(`/api/retoureklassen/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(c: ReturnClass) {
    setEditId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
    setEditCost(String(c.cost));
    setEditMaxWeight(c.max_weight != null ? String(c.max_weight / 1000) : "");
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retoureklassen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gewichtsbasierte Rücksendekosten · {venture.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="text-sm px-4 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14224D] transition-colors"
        >
          + Neue Gewichtsstufe
        </button>
      </div>

      {/* Erklärungs-Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Wie funktionieren Retoureklassen?</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Analog zu den Versandklassen — nach Gesamtgewicht der Rücksendung gestaffelt</li>
          <li>Jede Stufe hat ein Maximalgewicht (in kg) und einen Pauschalpreis</li>
          <li>Bei einer Retoure wird automatisch die passende Stufe anhand des Gesamtgewichts gewählt</li>
          <li>Die letzte Stufe (ohne Maximalgewicht) fängt alles oberhalb der anderen Stufen auf</li>
        </ul>
      </div>

      {/* Neue Klasse */}
      {showNew && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Neue Gewichtsstufe</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Name *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="z.B. Standard, Schwer, Sperrig"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bis Gewicht (kg)</label>
              <input
                type="text"
                inputMode="decimal"
                value={newMaxWeight}
                onChange={e => setNewMaxWeight(e.target.value)}
                placeholder="leer = unbegrenzt"
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
            <div className="col-span-2">
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

      {/* Klassenliste */}
      {loading ? (
        <p className="text-sm text-gray-400">Laden…</p>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center">
          <p className="text-sm text-gray-500">Noch keine Gewichtsstufen</p>
          <p className="text-xs text-gray-400 mt-1">Stufe anlegen um Retourekosten zu definieren</p>
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
                      <label className="text-xs text-gray-500 block mb-1">Bis Gewicht (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editMaxWeight}
                        onChange={e => setEditMaxWeight(e.target.value)}
                        placeholder="leer = unbegrenzt"
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
                    <div className="col-span-2">
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {c.max_weight != null ? `bis ${(c.max_weight / 1000).toLocaleString("de-DE")} kg` : "unbegrenzt"}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                    <p className="text-sm font-semibold mt-1" style={{ color: c.cost === 0 ? "#16A34A" : "#D97706" }}>
                      {c.cost === 0 ? "Kostenlos" : `${Number(c.cost).toFixed(2).replace(".", ",")} €`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
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
