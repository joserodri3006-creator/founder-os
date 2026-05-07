"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface Notification {
  id: string;
  venture: string;
  event_type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const EVENT_ICONS: Record<string, string> = {
  new_lead:             "👤",
  follow_up_due:        "⏰",
  draft_ready:          "✉️",
  order_status_changed: "📋",
  payment_due:          "💳",
  ki_search_done:       "🤖",
  sync_failed:          "⚠️",
  invoice_not_sent:     "📄",
};

const EVENT_LABELS: Record<string, string> = {
  new_lead:             "Neuer Lead",
  follow_up_due:        "Follow-up fällig",
  draft_ready:          "Draft bereit",
  order_status_changed: "Auftrag",
  payment_due:          "Zahlung fällig",
  ki_search_done:       "KI-Suche",
  sync_failed:          "Sync-Fehler",
  invoice_not_sent:     "Rechnung",
};

type Filter = "all" | "unread" | "read";

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "Gerade eben";
  if (mins  < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
}

const PAGE_SIZE = 25;

export default function BenachrichtigungenPage() {
  const { venture } = useVenture();
  const [items, setItems]   = useState<Notification[]>([]);
  const [total, setTotal]   = useState(0);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: Filter, o: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      venture,
      limit:       String(PAGE_SIZE),
      offset:      String(o),
      ...(f === "unread" ? { unread_only: "true" } : {}),
    });
    const res  = await fetch(`/api/notifications?${params}`);
    const data = await res.json();
    const all  = data.notifications ?? [];
    setItems(f === "read" ? all.filter((n: Notification) => n.read) : all);
    setTotal(data.total ?? 0);
    setUnread(data.unread ?? 0);
    setLoading(false);
  }, [venture]);

  useEffect(() => {
    setOffset(0);
    load(filter, 0);
  }, [filter, venture, load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, venture }),
    });
    load(filter, offset);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",    label: "Alle" },
    { key: "unread", label: `Ungelesen${unread > 0 ? ` (${unread})` : ""}` },
    { key: "read",   label: "Gelesen" },
  ];

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
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
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {total} gesamt · {unread} ungelesen
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              background: "rgba(200,169,110,0.1)",
              color: "#C8A96E",
              border: "1px solid rgba(200,169,110,0.3)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,169,110,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(200,169,110,0.1)")}
          >
            Alle als gelesen markieren
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div
        className="flex gap-1 mb-5 p-1 rounded-xl"
        style={{ background: "#EEF0F7", display: "inline-flex" }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
            style={
              filter === f.key
                ? { background: "#FFFFFF", color: "#14193A", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                : { background: "transparent", color: "#6B7280" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: "#6B7280" }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }} />
            <span className="text-sm">Laden…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span style={{ fontSize: "36px" }}>🔔</span>
            <p className="text-sm" style={{ color: "#6B7280" }}>Keine Benachrichtigungen</p>
          </div>
        ) : (
          items.map((n, i) => (
            <div
              key={n.id}
              style={{
                background: n.read ? "transparent" : "rgba(27,42,94,0.03)",
                borderBottom: i < items.length - 1 ? "1px solid #F3F4F6" : "none",
              }}
            >
              <div
                className="flex gap-4 px-5 py-4"
                style={{ cursor: n.link ? "pointer" : "default" }}
                onClick={() => !n.read && markRead(n.id)}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={{ background: n.read ? "#F7F8FC" : "#EEF0F7" }}
                >
                  {EVENT_ICONS[n.event_type] ?? "🔔"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p
                        className="text-sm"
                        style={{
                          color: n.read ? "#6B7280" : "#14193A",
                          fontWeight: n.read ? 400 : 600,
                        }}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{n.body}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "#EEF0F7", color: "#6B7280" }}
                      >
                        {EVENT_LABELS[n.event_type] ?? n.event_type}
                      </span>
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>
                        {timeAgo(n.created_at)}
                      </span>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#1B2A5E" }} />
                      )}
                    </div>
                  </div>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => markRead(n.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium mt-2 transition-colors"
                      style={{ color: "#3A5BA0" }}
                    >
                      Öffnen →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => { const o = Math.max(0, offset - PAGE_SIZE); setOffset(o); load(filter, o); }}
            disabled={offset === 0}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-40"
            style={{ background: "#EEF0F7", color: "#1B2A5E" }}
          >
            ← Zurück
          </button>
          <span className="text-sm" style={{ color: "#6B7280" }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} von {total}
          </span>
          <button
            onClick={() => { const o = offset + PAGE_SIZE; setOffset(o); load(filter, o); }}
            disabled={offset + PAGE_SIZE >= total}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-40"
            style={{ background: "#EEF0F7", color: "#1B2A5E" }}
          >
            Weiter →
          </button>
        </div>
      )}
    </div>
  );
}
