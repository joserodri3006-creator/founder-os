"use client";

import { useEffect, useState } from "react";

interface ConfigEntry {
  key: string;
  value: string;
  description: string | null;
}

interface VentureConfig {
  venture: string;
  enabled: boolean;
  limit: number;
  region: string;
  focus: string;
  industry_hint: string;
  note_hint: string;
  sender_name: string;
  sender_email: string;
}

interface VentureInfo {
  name: string;
  address: string;
  city: string;
  email: string;
  website: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
}

interface WCConfig {
  shop_url: string;
  wc_consumer_key: string;
  wc_consumer_secret: string;
}

const EMPTY_WC_CONFIG: WCConfig = { shop_url: "", wc_consumer_key: "", wc_consumer_secret: "" };

const VENTURE_IDS = ["online_first", "brandary", "droplane", "blazed_outfitters", "worknest"];

const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First",
  brandary: "Brandary",
  droplane: "Droplane",
  blazed_outfitters: "Blazed Outfitters",
  worknest: "Worknest",
};

const EMPTY_VENTURE_INFO: VentureInfo = {
  name: "", address: "", city: "", email: "", website: "", taxId: "", bankName: "", iban: "", bic: "",
};

const SKIP_KEYS = ["ki_search_ventures"]; // wird separat gerendert

const BOOL_KEYS = ["ki_search_enabled"];
const HIDDEN_KEYS = ["ki_search_venture", "ki_search_daily_limit", "ki_search_region"];

export default function EinstellungenPage() {
  const [config, setConfig] = useState<ConfigEntry[]>([]);
  const [ventures, setVentures] = useState<VentureConfig[]>([]);
  const [ventureInfos, setVentureInfos] = useState<Record<string, VentureInfo>>({});
  const [ventureInfoDraft, setVentureInfoDraft] = useState<Record<string, VentureInfo>>({});
  const [wcConfigs, setWcConfigs] = useState<Record<string, WCConfig>>({});
  const [wcConfigDraft, setWcConfigDraft] = useState<Record<string, WCConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ConfigEntry[]) => {
        setConfig(data);
        const ventureEntry = data.find((d) => d.key === "ki_search_ventures");
        if (ventureEntry) {
          try { setVentures(JSON.parse(ventureEntry.value)); } catch { /* ignore */ }
        }
        // Load per-venture info
        const infos: Record<string, VentureInfo> = {};
        for (const id of VENTURE_IDS) {
          const entry = data.find((d) => d.key === `${id}_venture_info`);
          if (entry) {
            try { infos[id] = JSON.parse(entry.value); } catch { /* ignore */ }
          }
        }
        setVentureInfos(infos);
        setVentureInfoDraft(infos);

        // Load WooCommerce configs
        const wcData: Record<string, WCConfig> = {};
        for (const id of VENTURE_IDS) {
          const entry = data.find((d) => d.key === `${id}_wc_config`);
          if (entry) {
            try { wcData[id] = JSON.parse(entry.value); } catch { /* ignore */ }
          }
        }
        setWcConfigs(wcData);
        setWcConfigDraft(wcData);

        setLoading(false);
      });
  }, []);

  async function saveKey(key: string, value: string) {
    setSaving(key);
    await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setConfig((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  async function saveVentures(updated: VentureConfig[]) {
    setVentures(updated);
    await saveKey("ki_search_ventures", JSON.stringify(updated));
  }

  async function saveVentureInfo(id: string) {
    const info = ventureInfoDraft[id] ?? EMPTY_VENTURE_INFO;
    await saveKey(`${id}_venture_info`, JSON.stringify(info));
    setVentureInfos((prev) => ({ ...prev, [id]: info }));
  }

  async function saveWcConfig(id: string) {
    const wc = wcConfigDraft[id] ?? EMPTY_WC_CONFIG;
    await saveKey(`${id}_wc_config`, JSON.stringify(wc));
    setWcConfigs((prev) => ({ ...prev, [id]: wc }));
  }

  function updateVenture(idx: number, patch: Partial<VentureConfig>) {
    const updated = ventures.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    saveVentures(updated);
  }

  const generalConfig = config.filter(
    (c) => !SKIP_KEYS.includes(c.key) && !HIDDEN_KEYS.includes(c.key)
  );

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-semibold">Einstellungen</h1>

      {/* KI-Lead-Suche pro Venture */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold">KI-Lead-Suche</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Täglich um 08:00 Uhr — Claude sucht automatisch neue Leads pro Venture.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {ventures.map((v, idx) => (
            <div key={v.venture} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {VENTURE_LABELS[v.venture] ?? v.venture}
                  </p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => updateVenture(idx, { enabled: !v.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    v.enabled ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      v.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Sender — immer sichtbar */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Absender Name</label>
                  <input
                    type="text"
                    value={v.sender_name ?? ""}
                    onChange={(e) => updateVenture(idx, { sender_name: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Absender E-Mail</label>
                  <input
                    type="email"
                    value={v.sender_email ?? ""}
                    onChange={(e) => updateVenture(idx, { sender_email: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* KI-Suche — nur wenn aktiviert */}
              {v.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Limit pro Lauf</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={v.limit}
                      onChange={(e) => updateVenture(idx, { limit: parseInt(e.target.value) || 5 })}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Region</label>
                    <input
                      type="text"
                      value={v.region}
                      onChange={(e) => updateVenture(idx, { region: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Zielgruppe (Claude-Prompt)</label>
                    <textarea
                      value={v.focus}
                      rows={2}
                      onChange={(e) => updateVenture(idx, { focus: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {ventures.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Keine Venture-Konfiguration gefunden.
            </div>
          )}
        </div>

        {saved === "ki_search_ventures" && (
          <p className="text-xs text-green-600 mt-2">Gespeichert ✓</p>
        )}
      </section>

      {/* Venture Informationen (für Rechnungen) */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Venture Informationen</h2>
          <p className="text-sm text-gray-500 mt-0.5">Firmendaten für Rechnungen — Adresse, Bankverbindung, Steuernummer.</p>
        </div>
        <div className="space-y-3">
          {VENTURE_IDS.map((id) => {
            const draft = ventureInfoDraft[id] ?? EMPTY_VENTURE_INFO;
            const saved_ = JSON.stringify(ventureInfos[id] ?? EMPTY_VENTURE_INFO);
            const draft_ = JSON.stringify(draft);
            const isDirty = draft_ !== saved_;
            function upd(patch: Partial<VentureInfo>) {
              setVentureInfoDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_VENTURE_INFO), ...patch } }));
            }
            return (
              <div key={id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-800">{VENTURE_LABELS[id]}</p>
                  <div className="flex items-center gap-2">
                    {saved === `${id}_venture_info` && <span className="text-xs text-green-600">Gespeichert ✓</span>}
                    {isDirty && (
                      <button
                        onClick={() => saveVentureInfo(id)}
                        disabled={saving === `${id}_venture_info`}
                        className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === `${id}_venture_info` ? "..." : "Speichern"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Firmenname</label>
                    <input type="text" value={draft.name} onChange={(e) => upd({ name: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">E-Mail</label>
                    <input type="email" value={draft.email} onChange={(e) => upd({ email: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Straße</label>
                    <input type="text" value={draft.address} onChange={(e) => upd({ address: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">PLZ / Ort</label>
                    <input type="text" value={draft.city} onChange={(e) => upd({ city: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Website</label>
                    <input type="text" value={draft.website} onChange={(e) => upd({ website: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Steuernummer / USt-ID</label>
                    <input type="text" value={draft.taxId} onChange={(e) => upd({ taxId: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Bank</label>
                    <input type="text" value={draft.bankName} onChange={(e) => upd({ bankName: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">BIC</label>
                    <input type="text" value={draft.bic} onChange={(e) => upd({ bic: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">IBAN</label>
                    <input type="text" value={draft.iban} onChange={(e) => upd({ iban: e.target.value })}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* WooCommerce Konfiguration */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold">WooCommerce Konfiguration</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Shop-URL und API-Zugangsdaten für den Storefront-Sync pro Venture.
          </p>
        </div>
        <div className="space-y-3">
          {["blazed_outfitters", "brandary"].map((id) => {
            const draft = wcConfigDraft[id] ?? EMPTY_WC_CONFIG;
            const saved_ = JSON.stringify(wcConfigs[id] ?? EMPTY_WC_CONFIG);
            const isDirty = JSON.stringify(draft) !== saved_;
            function updWc(patch: Partial<WCConfig>) {
              setWcConfigDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_WC_CONFIG), ...patch } }));
            }
            return (
              <div key={id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-800">{VENTURE_LABELS[id]}</p>
                  <div className="flex items-center gap-2">
                    {saved === `${id}_wc_config` && <span className="text-xs text-green-600">Gespeichert ✓</span>}
                    {isDirty && (
                      <button
                        onClick={() => saveWcConfig(id)}
                        disabled={saving === `${id}_wc_config`}
                        className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === `${id}_wc_config` ? "..." : "Speichern"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Shop-URL</label>
                    <input type="url" value={draft.shop_url} onChange={(e) => updWc({ shop_url: e.target.value })}
                      placeholder="https://blazed-outfitters.com"
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Consumer Key</label>
                      <input type="password" value={draft.wc_consumer_key} onChange={(e) => updWc({ wc_consumer_key: e.target.value })}
                        placeholder="ck_…"
                        className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Consumer Secret</label>
                      <input type="password" value={draft.wc_consumer_secret} onChange={(e) => updWc({ wc_consumer_secret: e.target.value })}
                        placeholder="cs_…"
                        className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    WooCommerce → Einstellungen → Erweitert → REST API → Schlüssel erstellen
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Allgemeine Einstellungen */}
      <section>
        <h2 className="text-base font-semibold mb-4">Allgemeine Einstellungen</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {generalConfig.map((entry) => (
            <ConfigRow
              key={entry.key}
              entry={entry}
              isBool={BOOL_KEYS.includes(entry.key)}
              saving={saving === entry.key}
              saved={saved === entry.key}
              onSave={(value) => saveKey(entry.key, value)}
            />
          ))}
          {generalConfig.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Keine weiteren Einstellungen.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ConfigRow({
  entry,
  isBool,
  saving,
  saved,
  onSave,
}: {
  entry: ConfigEntry;
  isBool: boolean;
  saving: boolean;
  saved: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(entry.value);

  useEffect(() => { setDraft(entry.value); }, [entry.value]);

  const isDirty = draft !== entry.value;

  if (isBool) {
    const isTrue = entry.value === "true";
    return (
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{entry.key}</p>
          {entry.description && <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>}
        </div>
        <button
          onClick={() => onSave(isTrue ? "false" : "true")}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            isTrue ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isTrue ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800 mb-1">{entry.key}</p>
          {entry.description && <p className="text-xs text-gray-400 mb-2">{entry.description}</p>}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          {saved && <span className="text-xs text-green-600">✓</span>}
          {isDirty && (
            <button
              onClick={() => onSave(draft)}
              disabled={saving}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "..." : "Speichern"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
