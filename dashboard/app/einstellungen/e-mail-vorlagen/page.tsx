"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface EmailTemplate {
  id: string;
  venture: string;
  template_key: string;
  subject: string;
  intro_text: string;
  footer_text: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
  updated_at: string;
}

const KEY_LABELS: Record<string, { label: string; vars: string[] }> = {
  order_confirmation:            { label: "Bestellbestätigung",                vars: ["{{orderNumber}}"] },
  contact_team_notification:     { label: "Kontaktformular → Team",            vars: ["{{name}}", "{{email}}", "{{betreff}}"] },
  contact_customer_confirmation: { label: "Kontaktformular → Kundenbestätigung", vars: ["{{name}}", "{{email}}", "{{betreff}}"] },
  newsletter_team_notification:  { label: "Newsletter-Anmeldung → Team",       vars: ["{{email}}"] },
  retoure_team_notification:     { label: "Retoure-Anfrage → Team",            vars: ["{{orderRef}}", "{{email}}", "{{name}}"] },
  retoure_customer_confirmation: { label: "Retoure-Anfrage → Kundenbestätigung", vars: ["{{orderRef}}", "{{email}}", "{{name}}"] },
};

const EMPTY_FORM = {
  template_key: "",
  subject: "",
  intro_text: "",
  footer_text: "",
  from_name: "ITABA",
  from_email: "onboarding@resend.dev",
  is_active: true,
};

export default function EmailVorlagenPage() {
  const { venture } = useVenture();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/email-templates?venture=${venture}`).then(r => r.json());
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture]);

  function startEdit(t: EmailTemplate) {
    setEditing(t);
    setForm({
      template_key: t.template_key,
      subject: t.subject,
      intro_text: t.intro_text,
      footer_text: t.footer_text,
      from_name: t.from_name,
      from_email: t.from_email,
      is_active: t.is_active,
    });
    setShowNew(false);
    initPreviewVars(t.template_key);
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
    setPreviewVars({});
  }

  function initPreviewVars(key: string) {
    const info = KEY_LABELS[key];
    if (!info) { setPreviewVars({}); return; }
    const defaults: Record<string, string> = {
      "{{orderNumber}}": "ORD-2026-001",
      "{{name}}": "Max Mustermann",
      "{{email}}": "kunde@beispiel.de",
      "{{betreff}}": "Frage zu meiner Bestellung",
      "{{orderRef}}": "ORD-2026-001",
    };
    const vars: Record<string, string> = {};
    info.vars.forEach(v => { vars[v] = defaults[v] ?? "..."; });
    setPreviewVars(vars);
  }

  function resolvePlaceholders(text: string) {
    return Object.entries(previewVars).reduce(
      (t, [k, v]) => t.replaceAll(k, v),
      text
    );
  }

  async function save() {
    if (!form.template_key || !form.subject.trim()) return;
    setSaving(true);
    if (editing) {
      await fetch(`/api/email-templates/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          intro_text: form.intro_text,
          footer_text: form.footer_text,
          from_name: form.from_name,
          from_email: form.from_email,
          is_active: form.is_active,
        }),
      });
    } else {
      await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, venture }),
      });
    }
    cancel();
    await load();
    setSaving(false);
  }

  async function del(id: string, key: string) {
    if (!confirm(`Vorlage „${KEY_LABELS[key]?.label ?? key}" wirklich löschen? Itaba verwendet dann wieder die Standard-Texte.`)) return;
    await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleActive(t: EmailTemplate) {
    await fetch(`/api/email-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    await load();
  }

  const existingKeys = templates.map(t => t.template_key);
  const availableKeys = Object.keys(KEY_LABELS).filter(k => !existingKeys.includes(k));

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-gray-400 hover:text-gray-600">← Einstellungen</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">E-Mail-Vorlagen</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">E-Mail-Vorlagen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Betreff und Texte für transaktionale E-Mails anpassen (Platzhalter: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{{variable}}"}</code>)
          </p>
        </div>
        {availableKeys.length > 0 && (
          <button onClick={startNew} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            + Vorlage
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-5">
        Fehlt eine Vorlage, verwendet die App automatisch die einprogrammierten Standardtexte — kein Fehler, kein Absturz.
      </p>

      {/* Form */}
      {(showNew || editing) && (
        <div className="bg-white rounded-lg border border-blue-200 px-5 py-4 mb-5 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {editing ? `„${KEY_LABELS[editing.template_key]?.label ?? editing.template_key}" bearbeiten` : "Neue Vorlage"}
          </p>

          {/* Key selector (new only) */}
          {!editing && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vorlage *</label>
              <select
                value={form.template_key}
                onChange={e => {
                  setForm(f => ({ ...f, template_key: e.target.value }));
                  initPreviewVars(e.target.value);
                }}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Auswählen —</option>
                {availableKeys.map(k => (
                  <option key={k} value={k}>{KEY_LABELS[k]?.label ?? k}</option>
                ))}
              </select>
              {form.template_key && KEY_LABELS[form.template_key] && (
                <p className="text-xs text-gray-400 mt-1">
                  Verfügbare Platzhalter:{" "}
                  {KEY_LABELS[form.template_key].vars.map(v => (
                    <code key={v} className="text-xs bg-gray-100 px-1 py-0.5 rounded mr-1">{v}</code>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* Absender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Absendername</label>
              <input type="text" value={form.from_name}
                onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Absender-E-Mail</label>
              <input type="email" value={form.from_email}
                onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Betreff */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Betreff *</label>
            <input type="text" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="z.B. Deine Bestellung {{orderNumber}} ist eingegangen"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {form.subject && Object.keys(previewVars).length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Vorschau: <span className="italic">{resolvePlaceholders(form.subject)}</span>
              </p>
            )}
          </div>

          {/* Einleitungstext */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Einleitungstext</label>
            <textarea rows={3} value={form.intro_text}
              onChange={e => setForm(f => ({ ...f, intro_text: e.target.value }))}
              placeholder="Text zu Beginn der E-Mail, nach der Anrede..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            {form.intro_text && Object.keys(previewVars).length > 0 && (
              <p className="text-xs text-gray-400 mt-1 italic">{resolvePlaceholders(form.intro_text)}</p>
            )}
          </div>

          {/* Schlusstext */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Schlusstext</label>
            <textarea rows={2} value={form.footer_text}
              onChange={e => setForm(f => ({ ...f, footer_text: e.target.value }))}
              placeholder="Text am Ende der E-Mail, vor der Signatur..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Aktiv-Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            Aktiv (wird von der App verwendet)
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.template_key || !form.subject.trim()}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "…" : "Speichern"}
            </button>
            <button onClick={cancel}
              className="text-sm px-3 py-1.5 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Noch keine Vorlagen für dieses Venture.</p>
          <p className="text-xs text-gray-400 mt-1">Die App verwendet die einprogrammierten Standardtexte.</p>
          {availableKeys.length > 0 && (
            <button onClick={startNew} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
              Erste Vorlage anlegen →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const info = KEY_LABELS[t.template_key];
            return (
              <div key={t.id} className={`bg-white rounded-lg border px-5 py-4 ${t.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{info?.label ?? t.template_key}</p>
                      <code className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{t.template_key}</code>
                      {!t.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inaktiv</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">Betreff: {t.subject}</p>
                    {t.intro_text && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.intro_text}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-1">
                      von {t.from_name} &lt;{t.from_email}&gt; · {new Date(t.updated_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(t)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${t.is_active ? "border-gray-200 text-gray-500 hover:bg-gray-50" : "border-blue-200 text-blue-600 hover:bg-blue-50"}`}>
                      {t.is_active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button onClick={() => startEdit(t)} className="text-xs text-blue-500 hover:text-blue-700">Bearbeiten</button>
                    <button onClick={() => del(t.id, t.template_key)} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                  </div>
                </div>

                {/* Vars hint */}
                {info && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {info.vars.map(v => (
                      <code key={v} className="text-xs bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded">{v}</code>
                    ))}
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
