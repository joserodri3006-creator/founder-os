"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";

type HomepageSlot = {
  id: string;
  label: string;
  recommendedDimensions: string;
  fallbackUrl: string;
  url: string;
  storagePath: string | null;
  isFallback: boolean;
};

type PendingImage = { file: File; previewUrl: string };

export default function StartseitePage() {
  const { venture } = useVenture();
  const { canEdit } = useAuth();
  const [slots, setSlots] = useState<HomepageSlot[]>([]);
  const [pending, setPending] = useState<Record<string, PendingImage>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (venture !== "itaba") return;
    setLoading(true);
    fetch("/api/public/itaba-homepage-images")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Bilder konnten nicht geladen werden.");
        setSlots(body.slots ?? []);
      })
      .catch((error) => setMessage({ kind: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, [venture]);

  function selectImage(slotId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending((current) => {
      const previous = current[slotId];
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return { ...current, [slotId]: { file, previewUrl: URL.createObjectURL(file) } };
    });
    setMessage(null);
  }

  async function saveImages() {
    const entries = Object.entries(pending);
    if (!entries.length) return;
    setSaving(true);
    setMessage(null);

    try {
      let latestSlots = slots;
      for (const [slotId, image] of entries) {
        const formData = new FormData();
        formData.set("slot", slotId);
        formData.set("file", image.file);
        const response = await fetch("/api/public/itaba-homepage-images", { method: "POST", body: formData });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Bild konnte nicht gespeichert werden.");
        latestSlots = body.slots;
      }
      Object.values(pending).forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setSlots(latestSlots);
      setPending({});
      setMessage({ kind: "success", text: "Die Startseitenbilder wurden gespeichert." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  }

  if (venture !== "itaba") return null;

  const editable = canEdit("settings");
  const pendingCount = Object.keys(pending).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:p-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-light leading-tight tracking-[-0.02em] text-[#14193A]" style={{ fontFamily: "var(--font-serif)" }}>
            Website · Startseite
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
            Hier ersetzen Sie die Bilder auf der Itaba-Startseite. Wählen Sie ein Bild aus und speichern Sie anschließend Ihre Änderungen.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={saveImages}
            disabled={saving || pendingCount === 0}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: "#1B2A5E" }}
          >
            {saving ? "Wird gespeichert…" : `Änderungen speichern${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>
        )}
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
          Sie können die Bilder ansehen. Zum Ersetzen benötigen Sie die Berechtigung „Einstellungen bearbeiten“.
        </div>
      )}

      {loading ? (
        <div className="py-10 text-sm text-[#6B7280]">Bilder werden geladen…</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {slots.map((slot) => {
            const selected = pending[slot.id];
            const preview = selected?.previewUrl ?? slot.url;
            return (
              <article key={slot.id} className="overflow-hidden rounded-2xl border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)]">
                <div className="aspect-[16/10] bg-[#EEF0F7]">
                  <img src={preview} alt={`${slot.label} Vorschau`} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-[#14193A]">{slot.label}</h2>
                      <p className="mt-1 text-xs text-[#6B7280]">Empfohlen: {slot.recommendedDimensions}</p>
                    </div>
                    {selected && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Noch nicht gespeichert</span>
                    )}
                  </div>
                  {editable && (
                    <label className="mt-4 inline-flex cursor-pointer items-center rounded-lg border border-[#D1D5E8] px-3 py-2 text-sm font-semibold text-[#1B2A5E] hover:bg-[#F7F8FC]">
                      Bild ersetzen
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => selectImage(slot.id, event)}
                      />
                    </label>
                  )}
                  <p className="mt-2 text-[11px] text-[#9CA3AF]">JPG, PNG oder WebP · maximal 10 MB</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
