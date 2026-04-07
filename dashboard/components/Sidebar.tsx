"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { VENTURES, VentureId } from "@/lib/ventures";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/kunden", label: "Kunden" },
  { href: "/auftraege", label: "Aufträge" },
  { href: "/drafts", label: "KI-Drafts" },
  { label: "—", href: "", divider: true },
  { href: "/produkte", label: "Produkte" },
  { href: "/produkte/kategorien", label: "Kategorien" },
  { label: "—", href: "", divider: true },
  { href: "/einstellungen", label: "Einstellungen" },
  { href: "/einstellungen/zahlungsmodelle", label: "Zahlungsmodelle" },
  { href: "/einstellungen/produkttypen", label: "Produkttypen" },
  { href: "/einstellungen/marken", label: "Marken" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { venture, setVenture } = useVenture();
  const [open, setOpen] = useState(false);

  const current = VENTURES.find((v) => v.id === venture) ?? VENTURES[0];

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
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1">
            {VENTURES.map((v) => (
              <button
                key={v.id}
                onClick={() => { setVenture(v.id as VentureId); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                  v.id === venture ? "bg-blue-50" : ""
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${v.id === venture ? "text-blue-700" : "text-gray-800"}`}>
                    {v.label}
                  </p>
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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, i) => {
          if ((item as any).divider) return <div key={i} className="my-1 border-t border-gray-100" />;
          const active = pathname === item.href || (item.href.length > 1 && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Venture Badge unten */}
      <div className="px-4 py-3 border-t border-gray-100">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${current.color}`}>
          {current.label}
        </span>
      </div>
    </aside>
  );
}
