"use client";

import { useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";

export default function AnnouncementBannerPage() {
  const { venture } = useVenture();
  const { canEdit } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (venture !== "itaba") return;
    setLoading(true);
    fetch("/api/itaba-banner")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Banner konnte nicht geladen werden.");
        setEnabled(body.enabled);
        setText(body.text);
      })
      .catch((error) => setMessage({ kind: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, [venture]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/itaba-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Speichern fehlgeschlagen.");
      setEnabled(body.enabled);
      setText(body.text);
      setMessage({ kind: "success", text: "Der Banner wurde gespeichert." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  }

  if (venture !== "itaba") return null;

  const editable = canEdit("settings");

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:p-8">
      <div className="mb-7">
        <h1 className="text-[28px] font-light leading-tight tracking-[-0.02em] text-[#14193A]" style={{ fontFamily: "var(--font-serif)" }}>
          Website · Ankündigungsbanner
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
          Dieser Text erscheint als Banner ganz oben auf der Itaba-Startseite. Sie können ihn ein-/ausblenden oder den Text anpassen.
        </p>
      </div>

      {message && (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm"
          style={message.kind === "success"
            ? { background: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.25)", color: "#15803D" }
            : { background: "rgba(220,38,38,0.07)", borderColor: "rgba(220,38,38,0.2)", color: "#B91C1C" }}
        >
          {message.text}
        </div>
      )}

      {!editable && !loading && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sie können den Banner ansehen. Zum Bearbeiten benötigen Sie die Berechtigung „Einstellungen bearbeiten“.
        </div>
      )}

      {loading ? (
        <div className="py-10 text-sm text-[#6B7280]">Banner wird geladen…</div>
      ) : (
        <div className="rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.08)] space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!editable}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5E8]"
            />
            <span className="text-sm font-medium text-[#14193A]">Banner anzeigen</span>
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Text</label>
            <textarea
              value={text}
              disabled={!editable}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#D1D5E8] px-3 py-2 text-sm text-[#14193A] outline-none focus:ring-1 focus:ring-[#1B2A5E] disabled:bg-[#F7F8FC]"
              placeholder="z.B. Unser neuer Onlineshop ist da — ..."
            />
          </div>

          {editable && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !text.trim()}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "#1B2A5E" }}
            >
              {saving ? "Wird gespeichert…" : "Speichern"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
