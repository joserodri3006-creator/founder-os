"use client";

import { useCallback, useEffect, useState } from "react";
import { VENTURES } from "@/lib/ventures";
import { useVenture } from "@/context/VentureContext";

interface Pref {
  event_type: string;
  label: string;
  in_app: boolean;
  email: boolean;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center rounded-full transition-colors shrink-0"
      style={{
        width: "36px",
        height: "20px",
        background: checked ? "#1B2A5E" : "#D1D5E8",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.2s",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-transform"
        style={{
          width: "14px",
          height: "14px",
          left: "3px",
          transform: checked ? "translateX(16px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
        }}
      />
    </button>
  );
}

export default function BenachrichtigungenEinstellungenPage() {
  const { venture: activeVenture } = useVenture();
  const [selectedVenture, setSelectedVenture] = useState(activeVenture);
  const [prefs, setPrefs]     = useState<Pref[]>([]);
  const [saving, setSaving]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved]     = useState<string | null>(null);

  const loadPrefs = useCallback(async (v: string) => {
    setLoading(true);
    const res  = await fetch(`/api/notification-preferences?venture=${v}`);
    const data = await res.json();
    setPrefs(data.preferences ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setSelectedVenture(activeVenture);
  }, [activeVenture]);

  useEffect(() => {
    loadPrefs(selectedVenture);
  }, [selectedVenture, loadPrefs]);

  async function updatePref(event_type: string, field: "in_app" | "email", value: boolean) {
    const key = `${event_type}_${field}`;
    setSaving(key);

    // Optimistisch updaten
    setPrefs((prev) =>
      prev.map((p) => p.event_type === event_type ? { ...p, [field]: value } : p)
    );

    await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venture:    selectedVenture,
        event_type,
        in_app:     field === "in_app" ? value : prefs.find(p => p.event_type === event_type)?.in_app ?? true,
        email:      field === "email"  ? value : prefs.find(p => p.event_type === event_type)?.email ?? false,
      }),
    });

    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 300,
            fontSize: "28px",
            color: "#14193A",
            letterSpacing: "-0.02em",
          }}
        >
          Benachrichtigungen
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          Wähle pro Venture, über welche Ereignisse du informiert werden möchtest.
        </p>
      </div>

      {/* Info-Box E-Mail */}
      <div
        className="flex gap-3 p-4 rounded-xl mb-6"
        style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.2)" }}
      >
        <span style={{ fontSize: "18px" }}>📬</span>
        <div>
          <p className="text-sm font-medium" style={{ color: "#14193A" }}>E-Mail als täglicher Digest</p>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
            E-Mail-Benachrichtigungen werden täglich um 08:00 Uhr gebündelt versendet —
            nicht sofort. Absender: <span style={{ fontFamily: "monospace" }}>notify@onlinefirst.eu</span>
          </p>
        </div>
      </div>

      {/* Venture Tabs */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {VENTURES.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVenture(v.id)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
            style={
              selectedVenture === v.id
                ? { background: "#14193A", color: "#FFFFFF" }
                : { background: "#EEF0F7", color: "#6B7280" }
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Präferenzen-Tabelle */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        {/* Tabellen-Header */}
        <div
          className="grid px-5 py-3"
          style={{
            gridTemplateColumns: "1fr 80px 80px",
            borderBottom: "1px solid #EEF0F7",
            background: "#F7F8FC",
          }}
        >
          <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.07em", color: "#6B7280" }}>
            Ereignis
          </span>
          <span className="text-xs font-semibold uppercase text-center" style={{ letterSpacing: "0.07em", color: "#6B7280" }}>
            App
          </span>
          <span className="text-xs font-semibold uppercase text-center" style={{ letterSpacing: "0.07em", color: "#6B7280" }}>
            E-Mail
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: "#6B7280" }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }} />
            <span className="text-sm">Laden…</span>
          </div>
        ) : (
          prefs.map((pref, i) => {
            const inAppKey = `${pref.event_type}_in_app`;
            const emailKey = `${pref.event_type}_email`;
            return (
              <div
                key={pref.event_type}
                className="grid items-center px-5 py-4"
                style={{
                  gridTemplateColumns: "1fr 80px 80px",
                  borderBottom: i < prefs.length - 1 ? "1px solid #F3F4F6" : "none",
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#14193A" }}>{pref.label}</p>
                </div>

                {/* In-App Toggle */}
                <div className="flex justify-center items-center gap-1.5">
                  <Toggle
                    checked={pref.in_app}
                    onChange={(v) => updatePref(pref.event_type, "in_app", v)}
                    disabled={saving === inAppKey}
                  />
                  {saved === inAppKey && (
                    <span style={{ color: "#16A34A", fontSize: "11px" }}>✓</span>
                  )}
                </div>

                {/* E-Mail Toggle */}
                <div className="flex justify-center items-center gap-1.5">
                  <Toggle
                    checked={pref.email}
                    onChange={(v) => updatePref(pref.event_type, "email", v)}
                    disabled={saving === emailKey}
                  />
                  {saved === emailKey && (
                    <span style={{ color: "#16A34A", fontSize: "11px" }}>✓</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: "#9CA3AF" }}>
        Änderungen werden sofort gespeichert.
      </p>
    </div>
  );
}
