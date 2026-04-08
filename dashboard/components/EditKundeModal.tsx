"use client";

import { useState, useEffect } from "react";

const VENTURES = [
  { value: "online_first", label: "Online First" },
  { value: "blazed_outfitters", label: "Blazed Outfitters" },
  { value: "droplane", label: "Droplane" },
  { value: "brandary", label: "Brandary" },
];

interface Props {
  kundeId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditKundeModal({ kundeId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/kunden/${kundeId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          company_name: data.company_name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          city: data.city ?? "",
          street: data.street ?? "",
          postal_code: data.postal_code ?? "",
          country: data.country ?? "",
          venture: data.venture ?? "",
        });
        setLoading(false);
      });
  }, [kundeId]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/kunden/${kundeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        street: form.street || null,
        postal_code: form.postal_code || null,
        country: form.country || null,
        venture: form.venture || null,
      }),
    });
    setSaving(false);
    if (res.ok) { onSaved(); onClose(); }
    else setError("Fehler beim Speichern.");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: "13px",
    border: "1px solid #D1D5E8",
    borderRadius: "8px",
    padding: "8px 12px",
    background: "#FFFFFF",
    color: "#14193A",
    outline: "none",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(20,25,58,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="rounded-2xl p-8 text-sm" style={{ background: "#FFFFFF", color: "#6B7280" }}>Laden...</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 20px 56px rgba(27,42,94,0.24)",
          border: "1px solid #D1D5E8",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #EEF0F7" }}
        >
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
            Kunde bearbeiten
          </h2>
          <button
            onClick={onClose}
            style={{ color: "#6B7280", fontSize: "22px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Vorname</label>
              <input style={inputStyle} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Nachname</label>
              <input style={inputStyle} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Unternehmen</label>
            <input style={inputStyle} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>E-Mail</label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Stadt</label>
              <input style={inputStyle} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input style={inputStyle} value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Straße</label>
            <input style={inputStyle} value={form.street} onChange={(e) => set("street", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Venture</label>
            <select
              value={form.venture}
              onChange={(e) => set("venture", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— kein Venture —</option>
              {VENTURES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors"
              style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = "#243672"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#1B2A5E"; }}
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
              style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EEF0F7"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
