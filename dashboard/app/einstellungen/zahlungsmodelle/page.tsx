"use client";

import { useEffect, useState } from "react";

interface PaymentStep {
  step: number;
  label: string;
  percentage: number;
  trigger: string;
  due_days: number;
}

interface PaymentModel {
  id: string;
  venture: string;
  name: string;
  description: string | null;
  is_default: boolean;
  steps: PaymentStep[];
  payment_method: string;
  payment_term_days: number;
  currency: string;
}

const VENTURE_IDS = ["online_first", "brandary", "droplane", "blazed_outfitters", "worknest"];
const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First",
  brandary: "Brandary",
  droplane: "Droplane",
  blazed_outfitters: "Blazed Outfitters",
  worknest: "Worknest",
};
const VENTURE_COLORS: Record<string, string> = {
  online_first: "bg-blue-100 text-blue-700",
  brandary: "bg-green-100 text-green-700",
  droplane: "bg-purple-100 text-purple-700",
  blazed_outfitters: "bg-orange-100 text-orange-700",
  worknest: "bg-teal-100 text-teal-700",
};

const PAYMENT_METHODS = ["invoice", "prepayment", "woocommerce", "payout"];
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  invoice: "Rechnung",
  prepayment: "Vorkasse",
  woocommerce: "WooCommerce",
  payout: "Auszahlung",
};
const TRIGGER_OPTIONS = [
  "auftragserteilung", "briefing", "in_produktion", "abnahme",
  "abgeschlossen", "monatlich", "bestellung",
];

const EMPTY_MODEL: Omit<PaymentModel, "id" | "created_at" | "updated_at"> = {
  venture: "online_first",
  name: "",
  description: "",
  is_default: false,
  steps: [{ step: 1, label: "Zahlung", percentage: 100, trigger: "auftragserteilung", due_days: 14 }],
  payment_method: "invoice",
  payment_term_days: 14,
  currency: "EUR",
};

export default function ZahlungsmodellePage() {
  const [models, setModels] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY_MODEL | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/payment-models");
    const data = await res.json();
    setModels(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew(venture: string) {
    setDraft({ ...EMPTY_MODEL, venture });
    setEditId("new");
    setMsg(null);
  }

  function openEdit(model: PaymentModel) {
    setDraft({ ...model });
    setEditId(model.id);
    setMsg(null);
  }

  function closeEdit() {
    setEditId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);

    // Validate steps sum to 100
    const total = draft.steps.reduce((s, p) => s + p.percentage, 0);
    if (total !== 100) {
      setMsg({ type: "err", text: `Prozentsätze ergeben ${total}% — muss 100% sein.` });
      setSaving(false);
      return;
    }

    const res = editId === "new"
      ? await fetch("/api/payment-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        })
      : await fetch(`/api/payment-models/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });

    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: "err", text: data.error ?? "Fehler beim Speichern" });
    } else {
      setMsg({ type: "ok", text: "Gespeichert" });
      await load();
      closeEdit();
    }
    setSaving(false);
  }

  async function setDefault(model: PaymentModel) {
    await fetch(`/api/payment-models/${model.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    await load();
  }

  async function deleteModel(id: string) {
    if (!confirm("Zahlungsmodell löschen?")) return;
    await fetch(`/api/payment-models/${id}`, { method: "DELETE" });
    await load();
  }

  function updateStep(idx: number, patch: Partial<PaymentStep>) {
    if (!draft) return;
    const steps = draft.steps.map((s, i) => i === idx ? { ...s, ...patch } : s);
    setDraft({ ...draft, steps });
  }

  function addStep() {
    if (!draft) return;
    const next = (draft.steps[draft.steps.length - 1]?.step ?? 0) + 1;
    setDraft({
      ...draft,
      steps: [...draft.steps, { step: next, label: "Zahlung", percentage: 0, trigger: "auftragserteilung", due_days: 0 }],
    });
  }

  function removeStep(idx: number) {
    if (!draft) return;
    const steps = draft.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
    setDraft({ ...draft, steps });
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Zahlungsmodelle</h1>
          <p className="text-sm text-gray-500 mt-0.5">Flexible Zahlungsstrukturen pro Venture</p>
        </div>
      </div>

      {/* Editor */}
      {editId && draft && (
        <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-semibold mb-5">
            {editId === "new" ? "Neues Zahlungsmodell" : "Modell bearbeiten"}
          </h2>

          {msg && (
            <div className={`text-sm px-3 py-2 rounded-md mb-4 ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Venture</label>
              <select
                value={draft.venture}
                onChange={(e) => setDraft({ ...draft, venture: e.target.value })}
                disabled={editId !== "new"}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              >
                {VENTURE_IDS.map((v) => <option key={v} value={v}>{VENTURE_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Zahlungsart</label>
              <select
                value={draft.payment_method}
                onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z.B. 50/50 Standard"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Zahlungsziel (Tage Standard)</label>
              <input
                type="number"
                value={draft.payment_term_days}
                onChange={(e) => setDraft({ ...draft, payment_term_days: parseInt(e.target.value) || 0 })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
              <input
                type="text"
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Steps */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Zahlungsschritte</label>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${draft.steps.reduce((s, p) => s + p.percentage, 0) === 100 ? "text-green-600" : "text-red-500"}`}>
                  Summe: {draft.steps.reduce((s, p) => s + p.percentage, 0)}%
                </span>
                <button onClick={addStep} className="text-xs text-blue-600 hover:underline">+ Schritt</button>
              </div>
            </div>
            <div className="space-y-2">
              {draft.steps.map((step, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-md px-3 py-2">
                  <div className="col-span-1 text-xs text-gray-400 font-medium text-center">{step.step}</div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={step.label}
                      onChange={(e) => updateStep(idx, { label: e.target.value })}
                      placeholder="Label"
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={step.percentage}
                        onChange={(e) => updateStep(idx, { percentage: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <select
                      value={step.trigger}
                      onChange={(e) => updateStep(idx, { trigger: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {TRIGGER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={step.due_days}
                        onChange={(e) => updateStep(idx, { due_days: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">T</span>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {draft.steps.length > 1 && (
                      <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-3">
                <div className="col-span-1"></div>
                <div className="col-span-3">Label</div>
                <div className="col-span-2">Anteil</div>
                <div className="col-span-3">Trigger</div>
                <div className="col-span-2">+ Tage</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <button onClick={closeEdit} className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto cursor-pointer">
              <input type="checkbox" checked={draft.is_default}
                onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                className="rounded border-gray-300" />
              Als Standard für {VENTURE_LABELS[draft.venture]}
            </label>
          </div>
        </div>
      )}

      {/* Models by venture */}
      <div className="space-y-8">
        {VENTURE_IDS.map((ventureId) => {
          const ventureModels = models.filter((m) => m.venture === ventureId);
          return (
            <div key={ventureId}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VENTURE_COLORS[ventureId]}`}>
                    {VENTURE_LABELS[ventureId]}
                  </span>
                  <span className="text-xs text-gray-400">{ventureModels.length} Modell{ventureModels.length !== 1 ? "e" : ""}</span>
                </div>
                <button
                  onClick={() => openNew(ventureId)}
                  className="text-xs text-blue-600 hover:underline"
                >+ Neues Modell</button>
              </div>

              {ventureModels.length === 0 ? (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 px-5 py-6 text-center text-sm text-gray-400">
                  Kein Zahlungsmodell — Standard-Einstellungen werden genutzt.
                </div>
              ) : (
                <div className="space-y-2">
                  {ventureModels.map((model) => (
                    <div key={model.id}
                      className={`bg-white rounded-lg border px-5 py-4 ${model.is_default ? "border-blue-200" : "border-gray-200"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">{model.name}</p>
                            {model.is_default && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Standard</span>
                            )}
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              {PAYMENT_METHOD_LABELS[model.payment_method] ?? model.payment_method}
                            </span>
                          </div>
                          {model.description && <p className="text-xs text-gray-500 mb-2">{model.description}</p>}
                          {/* Steps preview */}
                          <div className="flex flex-wrap gap-2">
                            {model.steps.map((s) => (
                              <div key={s.step} className="text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1">
                                <span className="font-medium">{s.label}</span>
                                <span className="text-gray-400 ml-1">{s.percentage}%</span>
                                <span className="text-gray-300 mx-1">·</span>
                                <span className="text-gray-400">{s.trigger}</span>
                                {s.due_days > 0 && <span className="text-gray-400"> +{s.due_days}T</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!model.is_default && (
                            <button onClick={() => setDefault(model)}
                              className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded px-2 py-1 hover:border-blue-300 transition-colors">
                              Standard
                            </button>
                          )}
                          <button onClick={() => openEdit(model)}
                            className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded px-2 py-1 hover:border-blue-300 transition-colors">
                            Bearbeiten
                          </button>
                          {!model.is_default && (
                            <button onClick={() => deleteModel(model.id)}
                              className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded px-2 py-1 hover:border-red-300 transition-colors">
                              Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
