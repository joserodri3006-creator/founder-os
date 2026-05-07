"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "Gerade eben";
  if (mins  < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
}

export default function NotificationBell() {
  const { venture } = useVenture();
  const [open, setOpen]         = useState(false);
  const [items, setItems]       = useState<Notification[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch(`/api/notifications?venture=${venture}&limit=15`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {/* ignore */}
  }, [venture]);

  // Polling alle 30 Sekunden
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifications]);

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllRead() {
    setLoading(true);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, venture }),
    });
    setLoading(false);
    await fetchNotifications();
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

  return (
    <div ref={dropdownRef} className="relative">
      {/* Glocke */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
        style={{
          background: open ? "rgba(200,169,110,0.15)" : "transparent",
          color: "rgba(255,255,255,0.55)",
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "rgba(200,169,110,0.15)" : "transparent")}
        title="Benachrichtigungen"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
            style={{
              minWidth: "16px", height: "16px",
              fontSize: "9px", lineHeight: 1,
              background: "#DC2626",
              padding: "0 3px",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden z-50"
          style={{
            width: "320px",
            background: "#1B2A5E",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Benachrichtigungen</span>
              {unread > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#DC2626", color: "#fff" }}
                >
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs transition-colors"
                  style={{ color: "#C8A96E", background: "none", border: "none", cursor: "pointer" }}
                >
                  Alle gelesen
                </button>
              )}
              <Link
                href="/benachrichtigungen"
                onClick={() => setOpen(false)}
                className="text-xs transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Alle →
              </Link>
            </div>
          </div>

          {/* Liste */}
          <div style={{ maxHeight: "380px", overflowY: "auto" }}>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Keine Benachrichtigungen
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className="relative"
                  style={{
                    background: n.read ? "transparent" : "rgba(200,169,110,0.06)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => { markRead(n.id); setOpen(false); }}
                      className="flex gap-3 px-4 py-3 transition-colors block"
                      style={{ textDecoration: "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <NotificationItem n={n} />
                    </Link>
                  ) : (
                    <div
                      className="flex gap-3 px-4 py-3 cursor-default"
                      onClick={() => markRead(n.id)}
                    >
                      <NotificationItem n={n} />
                    </div>
                  )}
                  {/* Ungelesen-Dot */}
                  {!n.read && (
                    <span
                      className="absolute top-4 right-3 w-1.5 h-1.5 rounded-full"
                      style={{ background: "#C8A96E" }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 text-center"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Link
              href="/benachrichtigungen"
              onClick={() => setOpen(false)}
              className="text-xs font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Vollständige Inbox öffnen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ n }: { n: Notification }) {
  return (
    <>
      <span className="text-lg shrink-0 mt-0.5">{EVENT_ICONS[n.event_type] ?? "🔔"}</span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{ color: n.read ? "rgba(255,255,255,0.6)" : "#FFFFFF", fontWeight: n.read ? 400 : 500 }}
        >
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
            {n.body}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
          {timeAgo(n.created_at)}
        </p>
      </div>
    </>
  );
}
