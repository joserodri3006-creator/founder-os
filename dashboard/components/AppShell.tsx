"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";
import { getVenture } from "@/lib/ventures";

const SHELL_FREE_PATHS = ["/login", "/invite", "/auth", "/online-first", "/brandary", "/bewerten"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { venture } = useVenture();
  const { user } = useAuth();
  const activeVenture = getVenture(venture);

  const isAuthPage = SHELL_FREE_PATHS.some((p) => pathname?.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      {/* Backdrop for mobile sidebar */}
      {mobileOpen && (
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
            className="md:hidden flex items-center gap-3 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] shrink-0"
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
                padding: "10px",
                minWidth: "44px",
                minHeight: "44px",
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
            <span className="ml-auto max-w-[42vw] truncate rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>
              {activeVenture?.label ?? "Venture"}
            </span>
            {user?.role === "founder" && (
              <Link
                href="/whiteboards"
                aria-label="Whiteboards öffnen"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-xs font-semibold"
                style={{ background: pathname.startsWith("/whiteboards") ? "#C8A96E" : "rgba(255,255,255,0.1)", color: pathname.startsWith("/whiteboards") ? "#14193A" : "#FFFFFF" }}
              >
                Board
              </Link>
            )}
          </div>
        )}

        {/* Main scrollable content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "#F7F8FC", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
