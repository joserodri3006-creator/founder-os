"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";

interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  note?: string | null;
  venture: string;
}

interface TreeNode extends Location {
  children: TreeNode[];
}

function buildTree(locs: Location[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  locs.forEach(l => { map[l.id] = { ...l, children: [] }; });
  const roots: TreeNode[] = [];
  locs.forEach(l => {
    if (l.parent_id && map[l.parent_id]) {
      map[l.parent_id].children.push(map[l.id]);
    } else {
      roots.push(map[l.id]);
    }
  });
  return roots;
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
  loc: Location;
  onClose: () => void;
  onSaved: () => void;
}
function EditModal({ loc, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(loc.name);
  const [note, setNote] = useState(loc.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/produkt-lagerorte/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), note: note.trim() || null }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#14193A]">Lagerort bearbeiten</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notiz</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="z.B. nur Saisonware"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E] resize-none"
            />
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

// ── Depth badge ─────────────────────────────────────────────────────────────
function DepthBadge({ depth }: { depth: number }) {
  const styles = [
    "bg-[#1B2A5E] text-white",
    "bg-[#C8A96E]/20 text-[#8B6914]",
    "bg-gray-100 text-gray-500",
  ];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[depth] ?? styles[2]}`}>
      E{depth + 1}
    </span>
  );
}

// ── Tree Row ─────────────────────────────────────────────────────────────────
interface RowProps {
  node: TreeNode;
  onEdit: (loc: Location) => void;
  onDelete: (id: string, name: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  siblings: TreeNode[];
  depth?: number;
}
function LocationRow({ node, onEdit, onDelete, onMove, siblings, depth = 0 }: RowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isFirst = siblings[0]?.id === node.id;
  const isLast = siblings[siblings.length - 1]?.id === node.id;

  const indentClass = depth === 0 ? "" : `pl-${Math.min(depth * 6, 24)}`;
  const bgClass = depth === 0 ? "bg-white" : depth === 1 ? "bg-[#F7F8FC]" : "bg-gray-50";

  return (
    <>
      <div
        className={`${bgClass} ${indentClass} pr-4 py-3 flex items-center gap-2 group border-t border-gray-100 first:border-t-0`}
        style={{ paddingLeft: depth === 0 ? undefined : `${depth * 24 + 16}px` }}
      >
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-4 h-4 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-transform ${hasChildren ? "" : "opacity-0 pointer-events-none"}`}
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </button>

        <DepthBadge depth={depth} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${depth === 0 ? "text-[#14193A]" : depth === 1 ? "text-gray-700" : "text-gray-600"}`}>
              {node.name}
            </span>
            {node.children.length > 0 && (
              <span className="text-[10px] text-gray-400 shrink-0">{node.children.length} Unterorte</span>
            )}
          </div>
          {node.note && (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{node.note}</p>
          )}
        </div>

        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onMove(node.id, "up")} disabled={isFirst}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▲</button>
          <button onClick={() => onMove(node.id, "down")} disabled={isLast}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-[10px] leading-none px-1">▼</button>
        </div>

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

      {expanded && hasChildren && node.children.map(child => (
        <LocationRow
          key={child.id}
          node={child}
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
export default function LagerortePage() {
  const { venture } = useVenture();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editLoc, setEditLoc] = useState<Location | null>(null);

  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/produkt-lagerorte?venture=${venture}`).then(r => r.json());
    setLocations(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  // Breadcrumb-Pfad clientseitig aus parent_id zusammenbauen (kein DB-Level nötig)
  function pathFor(loc: Location): string {
    const names: string[] = [loc.name];
    let current = loc;
    while (current.parent_id) {
      const parent = locations.find(l => l.id === current.parent_id);
      if (!parent) break;
      names.unshift(parent.name);
      current = parent;
    }
    return names.join(" › ");
  }
  function depthFor(loc: Location): number {
    let depth = 0;
    let current = loc;
    while (current.parent_id) {
      const parent = locations.find(l => l.id === current.parent_id);
      if (!parent) break;
      depth += 1;
      current = parent;
    }
    return depth;
  }

  async function addLocation() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/produkt-lagerorte", {
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

  async function deleteLocation(id: string, name: string) {
    if (!confirm(`"${name}" löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    const res = await fetch(`/api/produkt-lagerorte/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Fehler beim Löschen");
    }
    await load();
  }

  async function moveLocation(id: string, direction: "up" | "down") {
    const loc = locations.find(l => l.id === id);
    if (!loc) return;
    const siblings = locations.filter(l => l.parent_id === loc.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex(l => l.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swapLoc = siblings[swapIdx];

    await Promise.all([
      fetch(`/api/produkt-lagerorte/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: swapLoc.sort_order }),
      }),
      fetch(`/api/produkt-lagerorte/${swapLoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: loc.sort_order }),
      }),
    ]);
    await load();
  }

  const tree = buildTree(locations);

  return (
    <>
      {editLoc && (
        <EditModal
          loc={editLoc}
          onClose={() => setEditLoc(null)}
          onSaved={async () => { setEditLoc(null); await load(); }}
        />
      )}

      <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#14193A]">Lagerorte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Frei konfigurierbare Lagerhierarchie · {locations.length} Lagerorte
          </p>
        </div>

        {/* Neuer Lagerort */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Neuer Lagerort</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="z.B. Halle A, Regal 5, Fach 12"
              onKeyDown={e => e.key === "Enter" && addLocation()}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
            <select
              value={newParent} onChange={e => setNewParent(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E] min-w-[180px]"
            >
              <option value="">Kein übergeordneter Ort</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{"  ".repeat(depthFor(l))}{depthFor(l) > 0 ? "↳ " : ""}{l.name}</option>
              ))}
            </select>
            <button
              onClick={addLocation} disabled={!newName.trim() || saving}
              className="text-sm px-5 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14193A] disabled:opacity-40 font-medium whitespace-nowrap"
            >
              {saving ? "…" : "+ Hinzufügen"}
            </button>
          </div>
          {newName.trim() && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-500">
              <span>Wird angelegt als:</span>
              <span className="font-medium text-gray-700">
                {newParent ? `${pathFor(locations.find(l => l.id === newParent)!)} › ` : ""}{newName.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Baum */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Laden…</div>
          ) : tree.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-3">📦</div>
              <p className="text-sm text-gray-500">Noch keine Lagerorte für {venture}</p>
              <p className="text-xs text-gray-400 mt-1">Füge oben den ersten Lagerort hinzu.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tree.map(node => (
                <LocationRow
                  key={node.id}
                  node={node}
                  onEdit={setEditLoc}
                  onDelete={deleteLocation}
                  onMove={moveLocation}
                  siblings={tree}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Lagerort-Regeln</p>
          <ul className="space-y-0.5 text-blue-600 list-disc list-inside">
            <li>Beliebig viele Ebenen — ganz nach der Struktur deines Lagers</li>
            <li>Lagerorte mit Unterorten können nicht gelöscht werden</li>
            <li>Sortierung per ▲▼ Buttons (hover zum Einblenden)</li>
            <li>Auf einem Produkt zuweisbar, sobald der Produkttyp Lagerbestand aktiviert hat</li>
          </ul>
        </div>
      </div>
    </>
  );
}
