"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";
import { VENTURES, VentureId } from "@/lib/ventures";
import NotificationBell from "@/components/NotificationBell";

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { venture, setVenture } = useVenture();
  const { user, signOut, canView, canEdit } = useAuth();
  const [open, setOpen] = useState(false);

  // Sidebar ausblenden auf Login/Invite-Seiten
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/online-first")
  ) {
    return null;
  }

  const current = VENTURES.find((v) => v.id === venture) ?? VENTURES[0];

  const navSections = [
    {
      items: [{ href: "/dashboard", label: "Dashboard", show: true }],
    },
    {
      label: "CRM",
      items: [
        { href: "/leads", label: "Leads", show: canView("leads") },
        { href: "/kunden", label: "Kunden", show: canView("customers") },
        { href: "/auftraege", label: "Aufträge", show: canView("orders") },
        { href: "/drafts", label: "KI-Drafts", show: canView("drafts") },
      ],
    },
    {
      label: "Produkte",
      items: [
        { href: "/produkte", label: "Produkte", show: canView("products") },
        { href: "/produkte/kategorien", label: "Kategorien", show: canView("products") },
        { href: "/produkte/sync-log", label: "Sync-Log", show: canView("products") },
      ],
    },
    {
      label: "Einstellungen",
      items: [
        { href: "/einstellungen", label: "Einstellungen", show: canEdit("settings") },
        { href: "/einstellungen/team", label: "Team", show: canEdit("settings") },
        { href: "/einstellungen/zahlungsmodelle", label: "Zahlungsmodelle", show: canEdit("settings") },
        { href: "/einstellungen/produkttypen", label: "Produkttypen", show: canEdit("settings") },
        { href: "/einstellungen/marken", label: "Marken", show: canEdit("settings") },
        { href: "/einstellungen/steuern", label: "Steuern", show: canEdit("settings") },
        { href: "/einstellungen/benachrichtigungen", label: "Benachrichtigungen", show: true },
      ],
    },
  ];

  function handleLinkClick() {
    setOpen(false);
    onCloseMobile?.();
  }

  /*
   * Positioning strategy:
   * - Mobile  (<md): fixed overlay, slides in/out via translateX
   * - Desktop (≥md): static in normal flex flow, always visible
   */
  const asideClasses = [
    // Always-on classes
    "flex flex-col shrink-0 h-full",
    // Mobile: fixed full-height drawer on the left
    "fixed inset-y-0 left-0 z-40",
    // Desktop: back to relative so it participates in flex layout
    "md:relative md:z-auto",
    // Slide animation
    "transition-transform duration-300 ease-in-out",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
  ].join(" ");

  return (
    <aside
      className={asideClasses}
      style={{
        width: "240px",
        background: "#14193A",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo + mobile close */}
      <div
        className="px-5 py-5 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-base font-semibold text-white"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "0.12em" }}
          >
            FOUNDER OS
          </span>
          <span style={{ color: "#C8A96E", fontSize: "20px", lineHeight: 1 }}>·</span>
        </div>

        {/* Close button — only on mobile */}
        <button
          onClick={onCloseMobile}
          aria-label="Menü schließen"
          className="md:hidden flex items-center justify-center rounded p-1 transition-colors"
          style={{ color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Venture Switcher */}
      <div
        className="px-4 py-3 relative shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p
          className="font-semibold uppercase mb-2"
          style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
        >
          Venture
        </p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
          style={{ background: "rgba(255,255,255,0.07)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-white leading-tight">{current.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{current.phase}</p>
          </div>
          <svg
            className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            style={{ color: "rgba(255,255,255,0.4)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute left-4 right-4 top-full mt-1 rounded-lg z-50 py-1 overflow-hidden"
            style={{
              background: "#1B2A5E",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {VENTURES.filter(v =>
              user?.role === "founder" || user?.venture === v.id || user?.venture === null
            ).map((v) => (
              <button
                key={v.id}
                onClick={() => { setVenture(v.id as VentureId); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors"
                style={{ background: v.id === venture ? "rgba(200,169,110,0.15)" : "transparent" }}
                onMouseEnter={e => { if (v.id !== venture) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = v.id === venture ? "rgba(200,169,110,0.15)" : "transparent"; }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: v.id === venture ? "#C8A96E" : "rgba(255,255,255,0.85)" }}
                  >
                    {v.label}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{v.phase}</p>
                </div>
                {v.id === venture && (
                  <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "#C8A96E" }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navSections.map((section, si) => {
          const visibleItems = section.items.filter(i => i.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={si}>
              {section.label && (
                <p
                  className="font-semibold uppercase px-3 mb-1.5"
                  style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}
                >
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const active =
                    pathname === item.href ||
                    (item.href.length > 1 && pathname.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className="flex items-center px-3 py-2 text-sm rounded-md transition-colors"
                      style={
                        active
                          ? {
                              background: "rgba(255,255,255,0.08)",
                              color: "#FFFFFF",
                              fontWeight: 500,
                              borderLeft: "3px solid #C8A96E",
                              paddingLeft: "9px",
                            }
                          : { color: "rgba(255,255,255,0.5)" }
                      }
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "#FFFFFF"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Glocke */}
      <div
        className="px-4 py-2 shrink-0 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/benachrichtigungen"
          onClick={handleLinkClick}
          className="text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          Benachrichtigungen
        </Link>
        <NotificationBell />
      </div>

      {/* User */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {user ? (
          <div className="flex items-center gap-2.5">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: "#C8A96E", color: "#14193A" }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">{user.name}</p>
              <p className="text-xs capitalize truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{user.role}</p>
            </div>
            <button
              onClick={signOut}
              title="Abmelden"
              className="transition-colors shrink-0 p-1 rounded"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{ background: "rgba(200,169,110,0.2)", color: "#C8A96E" }}
          >
            {current.label}
          </span>
        )}
      </div>
    </aside>
  );
}
