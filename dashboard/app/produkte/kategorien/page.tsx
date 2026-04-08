"use client";

import { useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export default function KategorienPage() {
  const { venture } = useVenture();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    const data = await fetch(`/api/produkt-kategorien?venture=${venture}`).then(r => r.json());
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture]);

  async function addCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/produkt-kategorien", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venture, name: newName.trim(), parent_id: newParent || null }),
    });
    setNewName(""); setNewParent("");
    await load();
    setSaving(false);
  }

  async function updateName(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/produkt-kategorien/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditId(null);
    await load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Kategorie löschen?")) return;
    await fetch(`/api/produkt-kategorien/${id}`, { method: "DELETE" });
    await load();
  }

  const roots = categories.filter(c => !c.parent_id);
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Kategorien</h1>
        <p className="text-sm text-gray-500 mt-1">Hierarchische Produktkategorien pro Venture.</p>
      </div>

      {/* Neue Kategorie */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-5 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Neue Kategorie</p>
        <div className="flex gap-3">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Name" onKeyDown={e => e.key === "Enter" && addCategory()}
            className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={newParent} onChange={e => setNewParent(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none">
            <option value="">— Oberkat. —</option>
            {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={addCategory} disabled={!newName.trim() || saving}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            {saving ? "..." : "Hinzufügen"}
          </button>
        </div>
      </div>

      {/* Kategoriebaum */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {roots.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Kategorien</div>
        )}
        {roots.map(cat => (
          <div key={cat.id}>
            <div className="px-5 py-3 flex items-center justify-between">
              {editId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && updateName(cat.id)}
                    autoFocus className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button onClick={() => updateName(cat.id)} className="text-xs text-blue-600 hover:text-blue-700">Speichern</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-gray-400">Abbrechen</button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }}
                      className="text-xs text-gray-400 hover:text-gray-600">Bearbeiten</button>
                    <button onClick={() => deleteCategory(cat.id)}
                      className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                  </div>
                </>
              )}
            </div>
            {/* Kinder */}
            {children(cat.id).map(child => (
              <div key={child.id} className="pl-10 pr-5 py-2.5 flex items-center justify-between border-t border-gray-50 bg-gray-50">
                {editId === child.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && updateName(child.id)}
                      autoFocus className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none" />
                    <button onClick={() => updateName(child.id)} className="text-xs text-blue-600">Speichern</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-gray-400">Abbrechen</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-600">↳ {child.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setEditId(child.id); setEditName(child.name); }}
                        className="text-xs text-gray-400 hover:text-gray-600">Bearbeiten</button>
                      <button onClick={() => deleteCategory(child.id)}
                        className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
