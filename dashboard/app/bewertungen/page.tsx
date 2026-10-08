"use client";

import { useCallback, useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author_display_name: string;
  author_name: string | null;
  public_consent: boolean;
  is_verified: boolean;
  status: "pending" | "published" | "flagged" | "rejected";
  moderation_reason: string | null;
  response_text: string | null;
  submitted_at: string;
  category_ratings: Record<string, number>;
  customer: { first_name: string | null; last_name: string | null; email: string | null } | null;
  order: { title: string | null } | null;
};

type Stats = {
  total: number; pending: number; published: number; average: number | null;
  invited: number; completed: number; conversion: number | null; unanswered_critical: number;
};

const STATUS_LABEL: Record<Review["status"], string> = {
  pending: "Zu prüfen", published: "Veröffentlicht", flagged: "Markiert", rejected: "Abgelehnt",
};
const CATEGORY_LABEL: Record<string, string> = { quality: "Qualität", communication: "Kommunikation", delivery: "Lieferung" };

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} von 5 Sternen`} style={{ color: "#C8A96E", letterSpacing: 1 }}>{"★".repeat(value)}<span style={{ color: "#D1D5DB" }}>{"★".repeat(5 - value)}</span></span>;
}

export default function BewertungenPage() {
  const { venture } = useVenture();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"alle" | Review["status"]>("alle");
  const [loading, setLoading] = useState(true);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (filter !== "alle") params.set("status", filter);
    const res = await fetch(`/api/reviews?${params}`);
    const data = await res.json();
    setReviews(res.ok ? data.reviews ?? [] : []);
    setStats(res.ok ? data.stats : null);
    setError(res.ok ? "" : data.error ?? "Bewertungen konnten nicht geladen werden.");
    setLoading(false);
  }, [venture, filter]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, payload: Record<string, string>) {
    setError("");
    const res = await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Aktion fehlgeschlagen."); return; }
    setReplyFor(null); setReply("");
    load();
  }

  function askReason(id: string, action: "reject" | "flag") {
    const reason = window.prompt(action === "reject" ? "Dokumentierter Ablehnungsgrund (nur bei Regelverstoß):" : "Grund für die Markierung:");
    if (reason?.trim()) act(id, { action, reason });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Bewertungen</h1>
      <p className="text-sm text-gray-500 mb-5">Verifizierte Kundenbewertungen. Negative Bewertungen werden nicht gelöscht; Ablehnung nur mit dokumentiertem Regelverstoß.</p>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            ["Ø Bewertung", stats.average ? `${stats.average.toString().replace(".", ",")} / 5` : "–"],
            ["Veröffentlicht", String(stats.published)],
            ["Zu prüfen", String(stats.pending)],
            ["Rücklaufquote", stats.conversion === null ? "–" : `${stats.conversion} %`],
            ["Kritisch offen", String(stats.unanswered_critical)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["alle", "pending", "published", "flagged", "rejected"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`text-sm px-3 py-1 rounded-full border ${filter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
            {s === "alle" ? "Alle" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Lade …</p> : reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Noch keine Bewertungen. Eine Einladung wird automatisch versendet, sobald ein Blazed-Auftrag auf „Abgeschlossen“ gesetzt wird.
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-medium">{r.title || "Ohne Titel"}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{STATUS_LABEL[r.status]}</span>
                {r.is_verified && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Verifiziert</span>}
                {!r.public_consent && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Keine Veröffentlichungsfreigabe</span>}
              </div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{r.body}</p>
              {Object.keys(r.category_ratings ?? {}).length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{Object.entries(r.category_ratings).map(([k, v]) => `${CATEGORY_LABEL[k] ?? k}: ${v}/5`).join(" · ")}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {r.customer ? `${r.customer.first_name ?? ""} ${r.customer.last_name ?? ""}`.trim() : r.author_name ?? "Unbekannt"}
                {r.order?.title ? ` · ${r.order.title}` : ""} · öffentlich als „{r.author_display_name}“ · {new Date(r.submitted_at).toLocaleDateString("de-DE")}
              </p>
              {r.moderation_reason && <p className="text-xs text-amber-700 mt-1">Moderation: {r.moderation_reason}</p>}
              {r.response_text && <p className="text-sm mt-3 border-l-2 border-[#C8A96E] pl-3 text-gray-700"><strong>Antwort:</strong> {r.response_text}</p>}

              {replyFor === r.id && (
                <div className="mt-3">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={1500} className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Sachliche, persönliche Antwort ohne Werbung …" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => act(r.id, { action: "reply", response_text: reply })} className="text-sm px-3 py-1 rounded-md bg-gray-900 text-white">Antwort speichern</button>
                    <button onClick={() => setReplyFor(null)} className="text-sm px-3 py-1 rounded-md border border-gray-300">Abbrechen</button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                {r.status !== "published" && r.public_consent && <button onClick={() => act(r.id, { action: "publish" })} className="text-sm px-3 py-1 rounded-md bg-green-600 text-white">Veröffentlichen</button>}
                {r.status === "published" && <button onClick={() => act(r.id, { action: "unpublish" })} className="text-sm px-3 py-1 rounded-md border border-gray-300">Zurückziehen</button>}
                <button onClick={() => { setReplyFor(r.id); setReply(r.response_text ?? ""); }} className="text-sm px-3 py-1 rounded-md border border-gray-300">{r.response_text ? "Antwort bearbeiten" : "Antworten"}</button>
                {r.status !== "flagged" && <button onClick={() => askReason(r.id, "flag")} className="text-sm px-3 py-1 rounded-md border border-gray-300">Markieren</button>}
                {r.status !== "rejected" && <button onClick={() => askReason(r.id, "reject")} className="text-sm px-3 py-1 rounded-md border border-red-200 text-red-600">Ablehnen</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
