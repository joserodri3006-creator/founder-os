"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";
import { VENTURES, VentureId } from "@/lib/ventures";

export default function Sidebar() {
  const pathname = usePathname();
  const { venture, setVenture } = useVenture();
  const { user, signOut, canView, canEdit } = useAuth();
  const [open, setOpen] = useState(false);

  // Sidebar ausblenden auf Login/Invite-Seiten
  if (pathname.startsWith("/login") || pathname.startsWith("/invite") || pathname.startsWith("/auth")) {
    return null;
  }

  const current = VENTURES.find((v) => v.id === venture) ?? VENTURES[0];

  const navSections = [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", show: true },
      ],
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
      ],
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Venture Switcher */}
      <div className="px-4 py-4 border-b border-gray-200 relative">
        <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Venture</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{current.label}</p>
            <p className="text-xs text-gray-400">{current.phase}</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1">
            {VENTURES.filter(v =>
              user?.role === "founder" || user?.venture === v.id || user?.venture === null
            ).map((v) => (
              <button key={v.id}
                onClick={() => { setVenture(v.id as VentureId); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${v.id === venture ? "bg-blue-50" : ""}`}
              >
                <div>
                  <p className={`text-sm font-medium ${v.id === venture ? "text-blue-700" : "text-gray-800"}`}>{v.label}</p>
                  <p className="text-xs text-gray-400">{v.phase}</p>
                </div>
                {v.id === venture && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section, si) => {
          const visibleItems = section.items.filter(i => i.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={si}>
              {section.label && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 mb-1">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const active = pathname === item.href ||
                    (item.href.length > 1 && pathname.startsWith(item.href + "/"));
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                        active
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User unten */}
      <div className="px-4 py-3 border-t border-gray-100">
        {user ? (
          <div className="flex items-center gap-2">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
            <button onClick={signOut} title="Abmelden"
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${current.color}`}>{current.label}</span>
        )}
      </div>
    </aside>
  );
}
