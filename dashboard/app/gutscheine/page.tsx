"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVenture } from "@/context/VentureContext";
import { getVenture } from "@/lib/ventures";

interface Voucher {
  id: string;
  code: string;
  type: "gift_card" | "discount_pct" | "discount_abs";
  value: number;
  currency: string;
  status: "active" | "redeemed" | "expired" | "disabled";
  uses_count: number;
  max_uses: number | null;
  valid_until: string | null;
  notes: string | null;
  customer_email: string | null;
  created_at: string;
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

function fmtWert(v: Voucher) {
  if (v.type === "discount_pct") return `${v.value} %`;
  return `${Number(v.value).toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${v.currency ?? "€"}`;
}

const STATUS_FILTERS = ["alle", "active", "redeemed", "expired", "disabled"] as const;

export default function GutscheinePage() {
  const { venture } = useVenture();
  const router = useRouter();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("alle");

  const meta = getVenture(venture);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (statusFilter !== "alle") params.set("status", statusFilter);
    const data = await fetch(`/api/gutscheine?${params}`).then((r) => r.json());
    setVouchers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [venture, statusFilter]);

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 300,
              fontSize: "28px",
              color: "#14193A",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Gutscheine
          </h1>
          {meta && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${meta.color}`}
            >
              {meta.label}
            </span>
          )}
        </div>
        <Link
          href="/gutscheine/neu"
          className="text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
          style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "#243672")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "#1B2A5E")
          }
        >
          + Neuer Gutschein
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-[#14193A] text-white border-[#14193A]"
                : "text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {s === "alle" ? "Alle" : STATUS_LABELS[s]}
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{ color: "#6B7280" }}>
          {vouchers.length} Gutscheine
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "#6B7280" }}>
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }}
          />
          <span className="text-sm">Laden...</span>
        </div>
      ) : vouchers.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}
        >
          <p className="text-sm mb-3" style={{ color: "#6B7280" }}>
            Keine Gutscheine gefunden
          </p>
          <Link href="/gutscheine/neu" className="text-sm" style={{ color: "#1B2A5E" }}>
            Ersten Gutschein anlegen →
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D1D5E8",
            boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "700px" }}>
              <thead>
                <tr
                  style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}
                >
                  {["Code", "Typ", "Wert", "Status", "Einlösungen", "Gültig bis", "Notiz"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 font-semibold uppercase text-left`}
                        style={{
                          fontSize: "11px",
                          letterSpacing: "0.07em",
                          color: "#6B7280",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr
                    key={v.id}
                    style={{ borderBottom: "1px solid #F7F8FC", cursor: "pointer" }}
                    onClick={() => router.push(`/gutscheine/${v.id}`)}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "#F7F8FC")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    {/* Code */}
                    <td className="px-4 py-3">
                      <span
                        className="font-mono font-semibold text-sm"
                        style={{ color: "#14193A" }}
                      >
                        {v.code}
                      </span>
                      {v.customer_email && (
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                          {v.customer_email}
                        </p>
                      )}
                    </td>
                    {/* Typ */}
                    <td className="px-4 py-3" style={{ color: "#6B7280", fontSize: "13px" }}>
                      {TYP_LABELS[v.type] ?? v.type}
                    </td>
                    {/* Wert */}
                    <td className="px-4 py-3 font-semibold" style={{ color: "#14193A" }}>
                      {fmtWert(v)}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          background: STATUS_BG[v.status] ?? "#F3F4F6",
                          color: STATUS_TEXT[v.status] ?? "#374151",
                        }}
                      >
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    {/* Einlösungen */}
                    <td className="px-4 py-3" style={{ color: "#6B7280", fontSize: "13px" }}>
                      {v.uses_count ?? 0}
                      {v.max_uses != null ? ` / ${v.max_uses}` : ""}
                    </td>
                    {/* Gültig bis */}
                    <td className="px-4 py-3" style={{ color: "#6B7280", fontSize: "13px" }}>
                      {v.valid_until ? fmt(v.valid_until) : "—"}
                    </td>
                    {/* Notiz */}
                    <td
                      className="px-4 py-3 max-w-[180px] truncate"
                      style={{ color: "#6B7280", fontSize: "13px" }}
                      title={v.notes ?? ""}
                    >
                      {v.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
