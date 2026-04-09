"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  level: number;
  path: string;
  description?: string;
  image_url?: string;
  meta_title?: string;
  meta_description?: string;
  venture: string;
}

interface TreeNode extends Category {
  children: TreeNode[];
}

function buildTree(cats: Category[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  cats.forEach(c => { map[c.id] = { ...c, children: [] }; });
  const roots: TreeNode[] = [];
  cats.forEach(c => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
  cat: Category;
  onClose: () => void;
  onSaved: () => void;
}
function EditModal({ cat, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");
  const [metaTitle, setMetaTitle] = useState(cat.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(cat.meta_description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/produkt-kategorien/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#14193A]">Kategorie bearbeiten</h2>

        {/* Slug (read-only) */}
        <div className="flex items-center gap-2 text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-1.5">
          <span className="text-gray-300">slug:</span>
          <span>{cat.slug}</span>
          <span className="text-gray-300 ml-auto">Ebene {cat.level}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E] resize-none"
            />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">SEO</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Meta-Titel <span className="text-gray-300">({metaTitle.length}/60)</span></label>
                <input
                  type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} maxLength={60}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Meta-Beschreibung <span className="text-gray-300">({metaDescription.length}/160)</span></label>
                <textarea
                  value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} maxLength={160}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E] resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50">
            Abbrechen
          </button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 text-sm bg-[#1B2A5E] text-white rounded-lg py-2 hover:bg-[#14193A] disabled:opacity-40 font-medium">
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Level badge ─────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: number }) {
  const styles = [
    "bg-[#1B2A5E] text-white",
    "bg-[#C8A96E]/20 text-[#8B6914]",
    "bg-gray-100 text-gray-500",
  ];
  const labels = ["L1", "L2", "L3"];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[level - 1] ?? styles[2]}`}>
      {labels[level - 1] ?? `L${level}`}
    </span>
  );
}

// ── Tree Row ─────────────────────────────────────────────────────────────────
interface RowProps {
  node: TreeNode;
  allCats: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string, name: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  siblings: TreeNode[];
  depth?: number;
}
function CategoryRow({ node, allCats, onEdit, onDelete, onMove, siblings, depth = 0 }: RowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isFirst = siblings[0]?.id === node.id;
  const isLast = siblings[siblings.length - 1]?.id === node.id;

  const indentClass = ["", "pl-6", "pl-12"][depth] ?? "pl-12";
  const bgClass = ["bg-white", "bg-[#F7F8FC]", "bg-gray-50"][depth] ?? "bg-gray-50";

  return (
    <>
      <div className={`${bgClass} ${indentClass} pr-4 py-3 flex items-center gap-2 group border-t border-gray-100 first:border-t-0`}>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-transform ${hasChildren ? "" : "opacity-0 pointer-events-none"}`}
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </button>

        <LevelBadge level={node.level} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${depth === 0 ? "text-[#14193A]" : depth === 1 ? "text-gray-700" : "text-gray-600"}`}>
              {node.name}
            </span>
            {node.children.length > 0 && (
              <span className="text-[10px] text-gray-400 shrink-0">{node.children.length} Unterkategorien</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-400 font-mono truncate">{node.slug}</span>
            {node.description && (
              <span className="text-[11px] text-gray-400 truncate hidden sm:block">· {node.description}</span>
            )}
          </div>
        </div>

        {/* Sort buttons */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onMove(node.id, "up")} disabled={isFirst}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▲</button>
          <button onClick={() => onMove(node.id, "down")} disabled={isLast}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▼</button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(node)}
            className="text-xs text-gray-400 hover:text-[#1B2A5E] px-2 py-1 rounded hover:bg-gray-100">
            Bearbeiten
          </button>
          <button onClick={() => onDelete(node.id, node.name)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">
            Löschen
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && node.children.map(child => (
        <CategoryRow
          key={child.id}
          node={child}
          allCats={allCats}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          siblings={node.children}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function KategorienPage() {
  const { venture } = useVenture();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCat, setEditCat] = useState<Category | null>(null);

  // New category form
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/produkt-kategorien?venture=${venture}`).then(r => r.json());
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  // Only allow parents at level 1 or 2 (adding child would be level 2 or 3 → max allowed)
  const validParents = categories.filter(c => c.level <= 2);

  // Determine resulting level for preview
  const selectedParent = categories.find(c => c.id === newParent);
  const resultingLevel = selectedParent ? selectedParent.level + 1 : 1;

  async function addCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/produkt-kategorien", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venture, name: newName.trim(), parent_id: newParent || null, sort_order: 0 }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Fehler beim Anlegen");
    } else {
      setNewName(""); setNewParent("");
    }
    await load();
    setSaving(false);
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`"${name}" löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    const res = await fetch(`/api/produkt-kategorien/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Fehler beim Löschen");
    }
    await load();
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const siblings = categories.filter(c => c.parent_id === cat.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex(c => c.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swapCat = siblings[swapIdx];

    // Swap sort_orders
    await Promise.all([
      fetch(`/api/produkt-kategorien/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: swapCat.sort_order }),
      }),
      fetch(`/api/produkt-kategorien/${swapCat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: cat.sort_order }),
      }),
    ]);
    await load();
  }

  const tree = buildTree(categories);
  const levelCounts = [1, 2, 3].map(l => categories.filter(c => c.level === l).length);

  return (
    <>
      {editCat && (
        <EditModal
          cat={editCat}
          onClose={() => setEditCat(null)}
          onSaved={async () => { setEditCat(null); await load(); }}
        />
      )}

      <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#14193A]">Kategorien</h1>
            <p className="text-sm text-gray-500 mt-1">
              3-stufige Kategoriehierarchie · {categories.length} Kategorien
            </p>
          </div>
          {/* Level stats */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {["Ebene 1", "Ebene 2", "Ebene 3"].map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2.5 py-1.5">
                <LevelBadge level={i + 1} />
                <span className="text-gray-600">{levelCounts[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Neue Kategorie */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Neue Kategorie</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Name der Kategorie"
              onKeyDown={e => e.key === "Enter" && addCategory()}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
            <select
              value={newParent} onChange={e => setNewParent(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E] min-w-[180px]"
            >
              <option value="">Keine (Ebene 1)</option>
              {validParents.map(c => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.level - 1)}{c.level > 1 ? "↳ " : ""}{c.name}
                </option>
              ))}
            </select>
            <button
              onClick={addCategory} disabled={!newName.trim() || saving}
              className="text-sm px-5 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14193A] disabled:opacity-40 font-medium whitespace-nowrap"
            >
              {saving ? "…" : "+ Hinzufügen"}
            </button>
          </div>
          {/* Level preview */}
          {newName.trim() && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-500">
              <span>Wird angelegt als:</span>
              <LevelBadge level={resultingLevel} />
              <span className="font-medium text-gray-700">
                {selectedParent ? `${selectedParent.path}/` : ""}{newName.trim().toLowerCase().replace(/\s+/g, "-")}
              </span>
              {resultingLevel === 3 && (
                <span className="text-amber-500 font-medium">· Maximale Tiefe</span>
              )}
            </div>
          )}
        </div>

        {/* Kategoriebaum */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Laden…</div>
          ) : tree.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-3">📁</div>
              <p className="text-sm text-gray-500">Noch keine Kategorien für {venture}</p>
              <p className="text-xs text-gray-400 mt-1">Füge oben die erste Kategorie hinzu.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tree.map(node => (
                <CategoryRow
                  key={node.id}
                  node={node}
                  allCats={categories}
                  onEdit={setEditCat}
                  onDelete={deleteCategory}
                  onMove={moveCategory}
                  siblings={tree}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Kategorieregeln</p>
          <ul className="space-y-0.5 text-blue-600 list-disc list-inside">
            <li>Maximal 3 Ebenen (Ebene 1 → 2 → 3)</li>
            <li>Slug und Pfad werden automatisch aus dem Namen generiert</li>
            <li>Kategorien mit Unterkategorien können nicht gelöscht werden</li>
            <li>Sortierung per ▲▼ Buttons (hover zum Einblenden)</li>
          </ul>
        </div>
      </div>
    </>
  );
}
