"use client";

import { useState } from "react";

const VENTURES = [
  { value: "online_first", label: "Online First" },
  { value: "blazed_outfitters", label: "Blazed Outfitters" },
  { value: "droplane", label: "Droplane" },
  { value: "brandary", label: "Brandary" },
];

// For customers and orders: copy to another venture
interface CopyToVentureProps {
  mode: "venture";
  entityId: string;
  entityName: string;
  entityLabel: string; // "Kunde" | "Auftrag"
  currentVenture: string;
  endpoint: string; // e.g. /api/kunden/[id]/copy
  onClose: () => void;
  onCopied: () => void;
}

// For products: duplicate within same venture (with new name)
interface CopyProduktProps {
  mode: "produkt";
  entityId: string;
  entityName: string;
  onClose: () => void;
  onCopied: (newId: string) => void;
}

type Props = CopyToVentureProps | CopyProduktProps;

export default function CopyEntityModal(props: Props) {
  const [venture, setVenture] = useState(
    props.mode === "venture"
      ? VENTURES.find((v) => v.value !== props.currentVenture)?.value ?? "online_first"
      : ""
  );
  const [newName, setNewName] = useState(
    props.mode === "produkt" ? `Kopie von ${props.entityName}` : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    setLoading(true);
    setError(null);

    const endpoint =
      props.mode === "venture"
        ? props.endpoint
        : `/api/produkte/${props.entityId}/copy`;

    const body =
      props.mode === "venture"
        ? { venture }
        : { name: newName };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      if (props.mode === "produkt") {
        props.onCopied(data.id);
      } else {
        props.onCopied();
      }
      props.onClose();
    } else {
      setError(data.error ?? "Fehler beim Kopieren.");
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

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

  const title =
    props.mode === "venture"
      ? `${props.entityLabel} kopieren`
      : "Produkt duplizieren";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl"
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
            {title}
          </h2>
          <button
            onClick={props.onClose}
            style={{ color: "#6B7280", fontSize: "22px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {props.mode === "venture" ? (
            <>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                <span className="font-semibold" style={{ color: "#14193A" }}>{props.entityName}</span>{" "}
                in folgendes Venture kopieren:
              </p>
              <div className="space-y-2">
                {VENTURES.filter((v) => v.value !== props.currentVenture).map((v) => (
                  <label
                    key={v.value}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                    style={{ border: venture === v.value ? "1.5px solid #1B2A5E" : "1px solid #D1D5E8", background: venture === v.value ? "#EEF0F7" : "#FFFFFF" }}
                  >
                    <input
                      type="radio"
                      name="venture"
                      value={v.value}
                      checked={venture === v.value}
                      onChange={() => setVenture(v.value)}
                      style={{ accentColor: "#1B2A5E" }}
                    />
                    <span className="text-sm font-medium" style={{ color: "#14193A" }}>{v.label}</span>
                  </label>
                ))}
                <label
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                  style={{ border: venture === props.currentVenture ? "1.5px solid #1B2A5E" : "1px solid #D1D5E8", background: venture === props.currentVenture ? "#EEF0F7" : "#FFFFFF" }}
                >
                  <input
                    type="radio"
                    name="venture"
                    value={props.currentVenture}
                    checked={venture === props.currentVenture}
                    onChange={() => setVenture(props.currentVenture)}
                    style={{ accentColor: "#1B2A5E" }}
                  />
                  <span className="text-sm font-medium" style={{ color: "#14193A" }}>
                    {VENTURES.find((v) => v.value === props.currentVenture)?.label}{" "}
                    <span style={{ color: "#6B7280", fontWeight: 400 }}>(aktuell)</span>
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Neuer Name für das duplizierte Produkt:
              </p>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Produktname…"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCopy}
              disabled={loading || (props.mode === "produkt" && !newName.trim())}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors"
              style={{
                background: "#1B2A5E",
                color: "#FFFFFF",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#243672"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#1B2A5E"; }}
            >
              {loading ? "Kopieren…" : "Kopieren"}
            </button>
            <button
              onClick={props.onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
              style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EEF0F7"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
