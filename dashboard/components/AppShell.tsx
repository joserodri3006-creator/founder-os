"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const SHELL_FREE_PATHS = ["/login", "/invite", "/auth", "/online-first"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isAuthPage = SHELL_FREE_PATHS.some((p) => pathname?.startsWith(p));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop for mobile sidebar */}
      {mobileOpen && !isAuthPage && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — handles its own mobile/desktop positioning */}
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Right side: mobile top bar + main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar — hidden on md+ */}
        {!isAuthPage && (
          <div
            className="md:hidden flex items-center gap-3 px-4 shrink-0"
            style={{
              height: "52px",
              background: "#14193A",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              zIndex: 20,
            }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Menü öffnen"
              style={{
                color: "rgba(255,255,255,0.7)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {/* Hamburger icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                color: "#FFFFFF",
                letterSpacing: "0.12em",
                fontSize: "13px",
                fontWeight: 400,
              }}
            >
              FOUNDER OS
            </span>
            <span style={{ color: "#C8A96E", fontSize: "18px", lineHeight: 1 }}>·</span>
          </div>
        )}

        {/* Main scrollable content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "#F7F8FC" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
