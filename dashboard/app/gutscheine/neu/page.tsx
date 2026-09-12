"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function generateVoucherCode() {
  let code = "GS-";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export default function NeuGutscheinPage() {
  const { venture } = useVenture();
  const router = useRouter();

  const [form, setForm] = useState({
    code: generateVoucherCode(),
    type: "discount_pct" as "gift_card" | "discount_pct" | "discount_abs",
    value: "",
    min_order_value: "",
    max_uses: "",
    single_use: false,
    valid_until: "",
    customer_email: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, val: unknown) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim()) return setError("Code ist erforderlich.");
    if (!form.value) return setError("Wert ist erforderlich.");

    setSaving(true);
    const body: Record<string, unknown> = {
      venture,
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: parseFloat(form.value),
      single_use: form.single_use,
    };
    if (form.min_order_value) body.min_order_value = parseFloat(form.min_order_value);
    if (form.max_uses) body.max_uses = parseInt(form.max_uses, 10);
    if (form.valid_until) body.valid_until = form.valid_until;
    if (form.customer_email) body.customer_email = form.customer_email;
    if (form.notes) body.notes = form.notes;

    const res = await fetch("/api/gutscheine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Fehler beim Speichern.");
      setSaving(false);
      return;
    }
    router.push("/gutscheine");
  }

  const labelClass = "text-xs font-semibold uppercase tracking-wide block mb-1";
  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: "14px",
    border: "1px solid #D1D5E8",
    borderRadius: "8px",
    padding: "9px 12px",
    background: "#FFFFFF",
    color: "#14193A",
    outline: "none",
    fontFamily: "var(--font-sans)",
  };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          href="/gutscheine"
          className="text-sm"
          style={{ color: "#6B7280" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#14193A")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6B7280")}
        >
          ← Gutscheine
        </Link>
        <span style={{ color: "#D1D5E8" }}>/</span>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 300,
            fontSize: "24px",
            color: "#14193A",
            letterSpacing: "-0.02em",
          }}
        >
          Neuer Gutschein
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D1D5E8",
            boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
          }}
        >
          {/* Code */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                required
                style={{ ...inputStyle, fontFamily: "monospace", flex: 1 }}
                placeholder="GS-XXXXXX"
              />
              <button
                type="button"
                onClick={() => set("code", generateVoucherCode())}
                className="text-sm px-4 py-2 rounded-lg font-medium shrink-0"
                style={{
                  background: "#EEF0F7",
                  color: "#14193A",
                  border: "1px solid #D1D5E8",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "#D1D5E8")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "#EEF0F7")
                }
              >
                Generieren
              </button>
            </div>
          </div>

          {/* Typ */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Typ
            </label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              style={inputStyle}
            >
              <option value="gift_card">Wert-Gutschein</option>
              <option value="discount_pct">Prozent-Rabatt</option>
              <option value="discount_abs">Absoluter Rabatt</option>
            </select>
          </div>

          {/* Wert */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Wert {form.type === "discount_pct" ? "(%)" : "(€)"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              required
              style={inputStyle}
              placeholder={form.type === "discount_pct" ? "z.B. 10" : "z.B. 25.00"}
            />
          </div>

          {/* Mindestbestellwert */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Mindestbestellwert (€) <span style={{ color: "#9CA3AF" }}>optional</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.min_order_value}
              onChange={(e) => set("min_order_value", e.target.value)}
              style={inputStyle}
              placeholder="z.B. 50.00"
            />
          </div>

          {/* Max. Einlösungen */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Max. Einlösungen <span style={{ color: "#9CA3AF" }}>optional</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.max_uses}
              onChange={(e) => set("max_uses", e.target.value)}
              style={inputStyle}
              placeholder="unbegrenzt"
            />
          </div>

          {/* Einmalig pro Kunde */}
          <div className="flex items-center gap-3">
            <input
              id="single_use"
              type="checkbox"
              checked={form.single_use}
              onChange={(e) => set("single_use", e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "#1B2A5E" }}
            />
            <label htmlFor="single_use" className="text-sm" style={{ color: "#14193A", cursor: "pointer" }}>
              Einmalig pro Kunde
            </label>
          </div>

          {/* Gültig bis */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Gültig bis <span style={{ color: "#9CA3AF" }}>optional</span>
            </label>
            <input
              type="date"
              value={form.valid_until}
              onChange={(e) => set("valid_until", e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Für bestimmten Kunden */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Für bestimmten Kunden (E-Mail) <span style={{ color: "#9CA3AF" }}>optional</span>
            </label>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => set("customer_email", e.target.value)}
              style={inputStyle}
              placeholder="kunde@beispiel.de"
            />
          </div>

          {/* Notiz */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Notiz <span style={{ color: "#9CA3AF" }}>optional</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Interne Notiz zum Gutschein..."
            />
          </div>

          {error && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ background: "rgba(220,38,38,0.08)", color: "#B91C1C" }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
              style={{
                background: saving ? "#6B7280" : "#1B2A5E",
                color: "#FFFFFF",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!saving) (e.currentTarget as HTMLElement).style.background = "#243672";
              }}
              onMouseLeave={(e) => {
                if (!saving) (e.currentTarget as HTMLElement).style.background = "#1B2A5E";
              }}
            >
              {saving ? "Speichern…" : "Gutschein anlegen"}
            </button>
            <Link
              href="/gutscheine"
              className="flex-1 py-2.5 text-sm font-medium rounded-lg text-center"
              style={{
                background: "transparent",
                color: "#14193A",
                border: "1.5px solid #D1D5E8",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#EEF0F7")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              Abbrechen
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
