"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Lead,
  LeadStatus,
  STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from "@/lib/types";

interface SwipeViewProps {
  leads: Lead[];
  onUpdateStatus: (id: string, status: LeadStatus) => void;
  onArchive: (id: string) => void;
}

// Swipe-Ergebnis: rechts = vorrücken im Funnel, links = verloren/ablehnen.
// Die genaue Zielspalte hängt vom aktuellen Status ab, damit "rechts" immer
// einen sinnvollen nächsten Schritt bedeutet statt eines festen Status.
const FORWARD_STEP: Partial<Record<LeadStatus, LeadStatus>> = {
  neu: "kontaktiert",
  in_bearbeitung: "kontaktiert",
  kontaktiert: "erstgespraech",
  follow_up: "erstgespraech",
  nachgefasst: "erstgespraech",
  erstgespraech: "qualifiziert",
  qualifiziert: "sales_gespraech",
  sales_gespraech: "angebot_gesendet",
  angebot_gesendet: "gewonnen",
};

function forwardTarget(status: LeadStatus): LeadStatus {
  return FORWARD_STEP[status] ?? status;
}

function openLeadIds(leads: Lead[]): string {
  return leads
    .filter((l) => l.status !== "verloren" && l.status !== "gewonnen")
    .map((l) => l.id)
    .sort()
    .join(",");
}

const SWIPE_THRESHOLD = 110; // px, ab wann eine Entscheidung ausgelöst wird
const SWIPE_MAX_ROTATE = 14; // Grad, maximale Kartenrotation beim Ziehen

export default function SwipeView({ leads, onUpdateStatus, onArchive }: SwipeViewProps) {
  // Eigener, stabiler Deck-State statt direkt aus `leads` abgeleitet: ein Swipe
  // ändert sofort den Status im Parent (optimistic update). Würde der Deck live
  // aus `leads` gefiltert, verschwände die gerade wegswipende Karte mitten in
  // ihrer Exit-Animation aus dem Array und der Index würde unter ihr wegspringen.
  // Der Deck wird deshalb nur neu aufgebaut, wenn sich die MENGE der offenen
  // Lead-IDs von außen ändert (neuer Filter, frisch geladen) — nicht bei einer
  // Status-Änderung, die diese Komponente selbst ausgelöst hat.
  const [deck, setDeck] = useState<Lead[]>(() =>
    leads.filter((l) => l.status !== "verloren" && l.status !== "gewonnen")
  );
  const seedIdsRef = useRef<string>(openLeadIds(leads));
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = openLeadIds(leads);
    if (ids !== seedIdsRef.current) {
      seedIdsRef.current = ids;
      setDeck(leads.filter((l) => l.status !== "verloren" && l.status !== "gewonnen"));
      setIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const current = deck[index];
  const next = deck[index + 1];

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setDragX(0);
    setExiting(null);
    setShowDetails(false);
  }, []);

  const decide = useCallback((direction: "left" | "right") => {
    if (!current) return;
    setExiting(direction);
    if (direction === "right") {
      onUpdateStatus(current.id, forwardTarget(current.status));
    } else {
      onUpdateStatus(current.id, "verloren");
    }
    setTimeout(advance, 220);
  }, [current, onUpdateStatus, advance]);

  function handlePointerDown(e: React.PointerEvent) {
    if (exiting) return;
    setDragging(true);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  }
  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      decide(dragX > 0 ? "right" : "left");
    } else {
      setDragX(0);
    }
  }

  if (!current) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}>
        <div className="text-4xl mb-3">🎉</div>
        <p className="text-sm font-medium" style={{ color: "#14193A" }}>Alle Leads durchgesehen</p>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Gewonnene und verlorene Leads erscheinen hier nicht erneut.</p>
      </div>
    );
  }

  const rotate = Math.max(-SWIPE_MAX_ROTATE, Math.min(SWIPE_MAX_ROTATE, dragX / 10));
  const rightOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
  const leftOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));

  const exitTransform = exiting === "right"
    ? "translateX(140%) rotate(18deg)"
    : exiting === "left"
    ? "translateX(-140%) rotate(-18deg)"
    : undefined;

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
        {index + 1} / {deck.length} · rechts wischen = weiter im Funnel · links wischen = verloren
      </p>

      <div className="relative w-full max-w-md" style={{ height: "560px" }}>
        {/* nächste Karte im Hintergrund, nur Andeutung */}
        {next && (
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "#FFFFFF",
              border: "1px solid #D1D5E8",
              transform: "scale(0.96) translateY(10px)",
              opacity: 0.6,
            }}
          />
        )}

        <div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D1D5E8",
            boxShadow: "0 12px 32px rgba(27,42,94,0.16)",
            transform: exiting
              ? exitTransform
              : `translateX(${dragX}px) rotate(${rotate}deg)`,
            transition: dragging ? "none" : "transform 0.25s ease",
            touchAction: "pan-y",
          }}
        >
          {/* Entscheidungs-Badges */}
          <div
            className="absolute top-6 left-6 z-10 px-3 py-1.5 rounded-lg font-bold text-sm border-2"
            style={{ borderColor: "#16A34A", color: "#16A34A", opacity: rightOpacity, transform: "rotate(-8deg)" }}
          >
            WEITER
          </div>
          <div
            className="absolute top-6 right-6 z-10 px-3 py-1.5 rounded-lg font-bold text-sm border-2"
            style={{ borderColor: "#DC2626", color: "#DC2626", opacity: leftOpacity, transform: "rotate(8deg)" }}
          >
            VERLOREN
          </div>

          {/* Karten-Inhalt */}
          <div className="h-full flex flex-col">
            <div className="px-6 pt-8 pb-5" style={{ background: "linear-gradient(135deg, #1B2A5E 0%, #14193A 100%)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF", letterSpacing: "0.05em" }}
                >
                  {STATUS_LABELS[current.status]}
                </span>
                {current.lead_potential && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{
                      background: current.lead_potential === "a_potential" ? "rgba(22,163,74,0.25)" : current.lead_potential === "b_potential" ? "rgba(200,169,110,0.3)" : "rgba(220,38,38,0.25)",
                      color: "#FFFFFF",
                    }}
                  >
                    {current.lead_potential === "a_potential" ? "A-Potenzial" : current.lead_potential === "b_potential" ? "B-Potenzial" : "Nicht passend"}
                  </span>
                )}
                {current.is_duplicate && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: "rgba(234,88,12,0.3)", color: "#FFFFFF" }}>
                    Duplikat
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-semibold text-white leading-tight">
                {current.first_name} {current.last_name}
              </h2>
              {current.company_name && (
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{current.company_name}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="E-Mail" value={current.email} />
                <Field label="Telefon" value={current.phone ?? "—"} />
                <Field label="Ort" value={[current.city, current.region].filter(Boolean).join(", ") || "—"} />
                <Field label="Branche" value={current.industry ?? "—"} />
                <Field label="Quelle" value={current.source} />
                <Field label="Follow-up" value={current.follow_up_date ? new Date(current.follow_up_date).toLocaleDateString("de-DE") : "—"} />
              </div>

              {current.website && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>Website</p>
                  <a href={current.website} target="_blank" rel="noreferrer" className="text-sm break-all" style={{ color: "#1B2A5E" }}>
                    {current.website}
                  </a>
                </div>
              )}

              {current.contact_reason && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>Anfragegrund</p>
                  <p className="text-sm" style={{ color: "#374151" }}>{current.contact_reason}</p>
                </div>
              )}

              {(current.notes || current.review_notes) && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>Notizen</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "#374151" }}>{current.notes || current.review_notes}</p>
                </div>
              )}

              <div className="pt-2 border-t" style={{ borderColor: "#F3F4F6" }}>
                <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#6B7280" }}>
                  Review {REVIEW_STATUS_LABELS[current.review_status ?? "unreviewed"]}
                </p>
                <Link href={`/leads/${current.id}`} className="text-xs font-medium" style={{ color: "#1B2A5E" }} target="_blank">
                  Vollständiges Profil öffnen →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktionsbuttons — funktionieren identisch zum Swipe, für Maus/Tastatur/Barrierefreiheit */}
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={() => decide("left")}
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold transition-transform hover:scale-105"
          style={{ background: "#FFFFFF", border: "2px solid #DC2626", color: "#DC2626" }}
          title="Verloren"
        >
          ✕
        </button>
        <button
          onClick={() => current && onArchive(current.id)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm transition-transform hover:scale-105"
          style={{ background: "#F3F4F6", border: "1px solid #D1D5E8", color: "#6B7280" }}
          title="Archivieren, ohne Status zu ändern"
        >
          ⤓
        </button>
        <button
          onClick={() => decide("right")}
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold transition-transform hover:scale-105"
          style={{ background: "#FFFFFF", border: "2px solid #16A34A", color: "#16A34A" }}
          title="Weiter im Funnel"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "#6B7280" }}>{label}</p>
      <p className="font-medium break-words" style={{ color: "#14193A" }}>{value}</p>
    </div>
  );
}
