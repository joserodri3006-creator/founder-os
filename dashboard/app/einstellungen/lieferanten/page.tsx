"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface Supplier {
  id: string;
  venture: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
}

const EMPTY: Omit<Supplier, "id" | "venture" | "created_at"> = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

export default function LieferantenPage() {
  const { venture } = useVenture();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/lieferanten?venture=${venture}`);
    const data = await res.json();
    setSuppliers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture]);

  function startEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contact_name: s.contact_name ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      website: s.website ?? "",
      notes: s.notes ?? "",
    });
    setShowNew(false);
  }

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setShowNew(true);
  }

  function cancel() {
    setEditing(null);
    setShowNew(false);
    setForm(EMPTY);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      website: form.website?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    if (editing) {
      await fetch(`/api/lieferanten/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/lieferanten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, venture }),
      });
    }
    cancel();
    await load();
    setSaving(false);
  }

  async function del(id: string, name: string) {
    if (!confirm(`Lieferant „${name}" wirklich löschen? Die Verknüpfung zu Produkten wird aufgehoben.`)) return;
    await fetch(`/api/lieferanten/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-gray-400 hover:text-gray-600">← Einstellungen</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">Lieferanten</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Lieferanten</h1>
          <p className="text-sm text-gray-500 mt-0.5">Händler und Lieferanten für Produkte verwalten</p>
        </div>
        <button
          onClick={startNew}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + Neu
        </button>
      </div>

      {/* Form (new or edit) */}
      {(showNew || editing) && (
        <div className="bg-white rounded-lg border border-blue-200 px-5 py-4 mb-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {editing ? `„${editing.name}" bearbeiten` : "Neuer Lieferant"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mustermann GmbH"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ansprechpartner</label>
              <input
                type="text"
                value={form.contact_name ?? ""}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Max Mustermann"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="info@lieferant.de"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Telefon</label>
              <input
                type="tel"
                value={form.phone ?? ""}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+49 ..."
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Website</label>
              <input
                type="url"
                value={form.website ?? ""}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Notizen</label>
              <textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !form.name.trim()}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "..." : "Speichern"}
            </button>
            <button
              onClick={cancel}
              className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center">
          <p className="text-sm text-gray-400">Noch keine Lieferanten für dieses Venture.</p>
          <button onClick={startNew} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
            Ersten Lieferanten anlegen →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-lg border border-gray-200 px-5 py-3.5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                  {s.contact_name && (
                    <span className="text-xs text-gray-500">{s.contact_name}</span>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="text-xs text-blue-500 hover:underline">{s.email}</a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="text-xs text-gray-500 hover:text-gray-700">{s.phone}</a>
                  )}
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener" className="text-xs text-blue-500 hover:underline truncate max-w-[180px]">
                      {s.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
                {s.notes && <p className="text-xs text-gray-400 mt-1 truncate">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(s)} className="text-xs text-blue-500 hover:text-blue-700">Bearbeiten</button>
                <button onClick={() => del(s.id, s.name)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
