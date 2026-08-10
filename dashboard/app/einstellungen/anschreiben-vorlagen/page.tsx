"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface OutreachTemplate {
  id: string;
  venture: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

const EMPTY_FORM = { name: "", subject: "", body: "" };
const PLACEHOLDERS = ["{{vorname}}", "{{nachname}}", "{{firma}}", "{{email}}"];
const PREVIEW_VARS: Record<string, string> = {
  "{{vorname}}": "Max",
  "{{nachname}}": "Mustermann",
  "{{firma}}": "Muster GmbH",
  "{{email}}": "max@muster.de",
};

function resolvePreview(text: string) {
  return Object.entries(PREVIEW_VARS).reduce((t, [k, v]) => t.replaceAll(k, v), text);
}

export default function AnschreibenVorlagenPage() {
  const { venture } = useVenture();
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<OutreachTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/outreach-templates?venture=${venture}`).then(r => r.json());
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture]);

  function startEdit(t: OutreachTemplate) {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body });
    setShowNew(false);
  }

  function startNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowNew(true);
  }

  function cancel() {
    setEditing(null);
    setShowNew(false);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) return;
    setSaving(true);
    if (editing) {
      await fetch(`/api/outreach-templates/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/outreach-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, venture }),
      });
    }
    cancel();
    await load();
    setSaving(false);
  }

  async function del(t: OutreachTemplate) {
    if (!confirm(`Vorlage „${t.name}" wirklich löschen?`)) return;
    await fetch(`/api/outreach-templates/${t.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-gray-400 hover:text-gray-600">← Einstellungen</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">Anschreiben-Vorlagen</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Anschreiben-Vorlagen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Frei benennbare Vorlagen für den manuellen E-Mail-Versand aus Lead-/Kundendetails
            (Platzhalter: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{{variable}}"}</code>)
          </p>
        </div>
        <button onClick={startNew} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shrink-0">
          + Vorlage
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-5">
        Verfügbare Platzhalter: {PLACEHOLDERS.map(p => (
          <code key={p} className="text-xs bg-gray-100 px-1 py-0.5 rounded mr-1">{p}</code>
        ))}
      </p>

      {(showNew || editing) && (
        <div className="bg-white rounded-lg border border-blue-200 px-5 py-4 mb-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {editing ? `„${editing.name}" bearbeiten` : "Neue Vorlage"}
          </p>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Name *</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Erstkontakt, Follow-up nach Angebot"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Betreff *</label>
            <input type="text" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="z.B. Kurze Frage zu {{firma}}"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {form.subject && <p className="text-xs text-gray-400 mt-1">Vorschau: <span className="italic">{resolvePreview(form.subject)}</span></p>}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Nachricht *</label>
            <textarea rows={6} value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={"Hallo {{vorname}},\n\n..."}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            {form.body && <p className="text-xs text-gray-400 mt-1 italic whitespace-pre-wrap">{resolvePreview(form.body)}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.name.trim() || !form.subject.trim() || !form.body.trim()}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "…" : "Speichern"}
            </button>
            <button onClick={cancel} className="text-sm px-3 py-1.5 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Noch keine Vorlagen für dieses Venture.</p>
          <button onClick={startNew} className="mt-3 text-sm text-blue-600 hover:text-blue-700">Erste Vorlage anlegen →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">Betreff: {t.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate whitespace-pre-line">{t.body}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(t)} className="text-xs text-blue-500 hover:text-blue-700">Bearbeiten</button>
                  <button onClick={() => del(t)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
