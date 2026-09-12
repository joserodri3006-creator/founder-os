"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Redemption {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  discount_applied: number | null;
  redeemed_at: string;
}

interface Voucher {
  id: string;
  venture: string;
  code: string;
  type: "gift_card" | "discount_pct" | "discount_abs";
  value: number;
  remaining_value: number | null;
  currency: string;
  min_order_value: number | null;
  max_uses: number | null;
  uses_count: number;
  single_use: boolean;
  status: "active" | "redeemed" | "expired" | "disabled";
  customer_email: string | null;
  customer_id: string | null;
  order_id: string | null;
  notes: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string | null;
  redemptions: Redemption[];
}

const TYP_LABELS: Record<string, string> = {
  gift_card: "Wert-Gutschein",
  discount_pct: "Prozent-Rabatt",
  discount_abs: "Absoluter Rabatt",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  redeemed: "Eingelöst",
  expired: "Abgelaufen",
  disabled: "Deaktiviert",
};

const STATUS_BG: Record<string, string> = {
  active: "rgba(22,163,74,0.1)",
  redeemed: "rgba(107,114,128,0.12)",
  expired: "rgba(220,38,38,0.08)",
  disabled: "rgba(220,38,38,0.08)",
};

const STATUS_TEXT: Record<string, string> = {
  active: "#15803D",
  redeemed: "#6B7280",
  expired: "#B91C1C",
  disabled: "#B91C1C",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtWert(type: string, value: number, currency: string) {
  if (type === "discount_pct") return `${value} %`;
  return `${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${currency ?? "€"}`;
}

export default function GutscheinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/gutscheine/${id}`).then((r) => r.json());
    if (data?.id) {
      setVoucher(data);
      setNotes(data.notes ?? "");
      setValidUntil(data.valid_until ? data.valid_until.split("T")[0] : "");
      setMaxUses(data.max_uses != null ? String(data.max_uses) : "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function patch(update: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/gutscheine/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Fehler beim Speichern.");
    } else {
      await load();
    }
    setSaving(false);
  }

  async function toggleStatus() {
    if (!voucher) return;
    const newStatus = voucher.status === "active" ? "disabled" : "active";
    await patch({ status: newStatus });
  }

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    const update: Record<string, unknown> = {
      notes: notes || null,
      valid_until: validUntil || null,
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
    };
    await patch(update);
  }

  function copyCode() {
    if (!voucher) return;
    navigator.clipboard.writeText(voucher.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
  const labelClass = "text-xs font-semibold uppercase tracking-wide block mb-1";

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 px-8" style={{ color: "#6B7280" }}>
        <div
          className="w-4 h-4 rounded-full border-2 animate-spin"
          style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }}
        />
        <span className="text-sm">Laden...</span>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Gutschein nicht gefunden.
        </p>
        <Link href="/gutscheine" className="text-sm mt-2 block" style={{ color: "#1B2A5E" }}>
          ← Zurück
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
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
        <span
          className="font-mono font-semibold"
          style={{ color: "#14193A", fontSize: "18px" }}
        >
          {voucher.code}
        </span>
      </div>

      {/* Code + Status row */}
      <div
        className="rounded-2xl p-5 mb-5 flex flex-wrap items-center gap-4 justify-between"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono text-2xl font-bold tracking-widest"
            style={{ color: "#14193A" }}
          >
            {voucher.code}
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: STATUS_BG[voucher.status] ?? "#F3F4F6",
              color: STATUS_TEXT[voucher.status] ?? "#374151",
            }}
          >
            {STATUS_LABELS[voucher.status] ?? voucher.status}
          </span>
          <span className="text-sm" style={{ color: "#6B7280" }}>
            {TYP_LABELS[voucher.type] ?? voucher.type}
          </span>
          <span className="font-semibold text-sm" style={{ color: "#14193A" }}>
            {fmtWert(voucher.type, voucher.value, voucher.currency)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
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
            {copied ? "✓ Kopiert" : "Code kopieren"}
          </button>

          <button
            onClick={toggleStatus}
            disabled={saving || ["redeemed", "expired"].includes(voucher.status)}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{
              background:
                voucher.status === "active" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.1)",
              color: voucher.status === "active" ? "#B91C1C" : "#15803D",
              border: "none",
              cursor: ["redeemed", "expired"].includes(voucher.status)
                ? "not-allowed"
                : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {voucher.status === "active" ? "Deaktivieren" : "Aktivieren"}
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div
        className="rounded-2xl p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Einlösungen</p>
          <p className="font-semibold text-sm" style={{ color: "#14193A" }}>
            {voucher.uses_count ?? 0}
            {voucher.max_uses != null ? ` / ${voucher.max_uses}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Einmalig pro Kunde</p>
          <p className="font-semibold text-sm" style={{ color: "#14193A" }}>
            {voucher.single_use ? "Ja" : "Nein"}
          </p>
        </div>
        {voucher.min_order_value != null && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Mindestbestellwert</p>
            <p className="font-semibold text-sm" style={{ color: "#14193A" }}>
              {Number(voucher.min_order_value).toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}{" "}
              {voucher.currency}
            </p>
          </div>
        )}
        {voucher.type === "gift_card" && voucher.remaining_value != null && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Restguthaben</p>
            <p className="font-semibold text-sm" style={{ color: "#14193A" }}>
              {Number(voucher.remaining_value).toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}{" "}
              {voucher.currency}
            </p>
          </div>
        )}
        {voucher.customer_email && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Kunde</p>
            <p className="font-semibold text-sm" style={{ color: "#14193A" }}>
              {voucher.customer_email}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Erstellt</p>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {fmt(voucher.created_at)}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={saveEdits}>
        <div
          className="rounded-2xl p-5 mb-5 space-y-4"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D1D5E8",
            boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "16px",
              color: "#14193A",
            }}
          >
            Bearbeiten
          </h2>

          {/* Gültig bis */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Gültig bis
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Max. Einlösungen */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Max. Einlösungen
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              style={inputStyle}
              placeholder="unbegrenzt"
            />
          </div>

          {/* Notiz */}
          <div>
            <label className={labelClass} style={{ color: "#6B7280" }}>
              Notiz
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Interne Notiz..."
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

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg"
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
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>

      {/* Einlösungshistorie */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #EEF0F7" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "16px",
              color: "#14193A",
            }}
          >
            Einlösungshistorie
          </h2>
        </div>

        {voucher.redemptions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Noch keine Einlösungen.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F7F8FC", borderBottom: "1px solid #EEF0F7" }}>
                {["Datum", "Bestellung", "Rabatt"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left font-semibold uppercase"
                    style={{ fontSize: "11px", letterSpacing: "0.07em", color: "#6B7280" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {voucher.redemptions.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid #F7F8FC" }}
                >
                  <td className="px-5 py-3" style={{ color: "#6B7280" }}>
                    {fmtDateTime(r.redeemed_at)}
                  </td>
                  <td className="px-5 py-3">
                    {r.order_id ? (
                      <Link
                        href={`/auftraege/${r.order_id}`}
                        className="text-sm font-mono"
                        style={{ color: "#1B2A5E" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.order_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span style={{ color: "#6B7280" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-semibold" style={{ color: "#14193A" }}>
                    {r.discount_applied != null
                      ? `${Number(r.discount_applied).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })} ${voucher.currency}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
