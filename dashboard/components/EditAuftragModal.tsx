"use client";

import { useState, useEffect } from "react";

const STATUS_OPTIONS = [
  { value: "neu", label: "Neu" },
  { value: "briefing", label: "Briefing" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "in_produktion", label: "In Produktion" },
  { value: "review", label: "Review" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
  { value: "nachbetreuung", label: "Nachbetreuung" },
  { value: "storniert", label: "Storniert" },
  { value: "pausiert", label: "Pausiert" },
  { value: "angebot_gesendet", label: "Angebot gesendet" },
];

interface Props {
  auftragId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditAuftragModal({ auftragId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/auftraege/${auftragId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          title: data.title ?? "",
          status: data.status ?? "neu",
          value: data.value != null ? String(data.value) : "",
          deadline: data.deadline ? data.deadline.split("T")[0] : "",
          package_type: data.package_type ?? "",
          description: data.description ?? "",
        });
        setLoading(false);
      });
  }, [auftragId]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/auftraege/${auftragId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        status: form.status,
        value: form.value ? parseFloat(form.value.replace(",", ".")) : null,
        deadline: form.deadline || null,
        package_type: form.package_type || null,
        description: form.description || null,
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
            Auftrag bearbeiten
          </h2>
          <button
            onClick={onClose}
            style={{ color: "#6B7280", fontSize: "22px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label style={labelStyle}>Titel *</label>
            <input
              required
              style={inputStyle}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Wert (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                style={inputStyle}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Deadline</label>
              <input
                type="date"
                style={inputStyle}
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Pakettyp</label>
              <input
                style={inputStyle}
                value={form.package_type}
                onChange={(e) => set("package_type", e.target.value)}
                placeholder="z.B. Starter, Pro…"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Beschreibung</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
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
