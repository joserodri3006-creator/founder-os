"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const fieldClass = "mt-2 w-full rounded-xl border border-[#DED7C9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1B2A5E]";

export default function BriefingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F7F2]" />}>
      <BriefingForm />
    </Suspense>
  );
}

function BriefingForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        business_description: form.get("business_description"),
        target_audience: form.get("target_audience"),
        core_offer: form.get("core_offer"),
        primary_call_to_action: form.get("primary_call_to_action"),
        preferred_pages: form.get("preferred_pages"),
        visual_direction: form.get("visual_direction"),
        existing_assets: form.get("existing_assets"),
        domain_access: form.get("domain_access"),
        booking_link: form.get("booking_link"),
        additional_notes: form.get("additional_notes"),
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Das Briefing konnte nicht gespeichert werden.");
    else setSubmitted(true);
    setPending(false);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F2] px-6 text-[#14193A]">
        <p>Dieser Briefing-Link ist unvollständig. Bitte verwenden Sie den Link aus Ihrer E-Mail.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F7F2] px-6 text-[#14193A]">
        <div className="max-w-xl rounded-3xl border border-[#E5DDCE] bg-white p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-700">Briefing eingegangen</p>
          <h1 className="mt-5 font-serif text-4xl font-light">Danke. Ihr Projekt kann starten.</h1>
          <p className="mt-5 leading-7 text-[#536079]">
            Ihre Angaben wurden dem Auftrag zugeordnet. Online First meldet sich mit dem Produktionsstart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2] px-6 py-10 text-[#14193A]">
      <form onSubmit={submit} className="mx-auto max-w-3xl rounded-3xl border border-[#E5DDCE] bg-white p-7 shadow-sm sm:p-11">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A07840]">Projektbriefing</p>
        <h1 className="mt-4 font-serif text-4xl font-light">Die Grundlage Ihrer neuen Website</h1>
        <p className="mt-5 text-sm leading-7 text-[#536079]">
          Bitte beschreiben Sie Angebot, Zielgruppe und gewünschte Wirkung. Ihre Antworten landen direkt in Ihrem Auftrag.
        </p>
        <div className="mt-9 space-y-6">
          <label className="block text-sm font-medium">Was macht Ihr Unternehmen und wofür stehen Sie? *
            <textarea className={fieldClass} name="business_description" rows={4} required />
          </label>
          <label className="block text-sm font-medium">Wer ist Ihre ideale Zielgruppe? *
            <textarea className={fieldClass} name="target_audience" rows={3} required />
          </label>
          <label className="block text-sm font-medium">Welches Kernangebot soll verkauft werden? *
            <textarea className={fieldClass} name="core_offer" rows={3} required />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">Primäre Handlung der Besucher *
              <input className={fieldClass} name="primary_call_to_action" placeholder="z. B. Erstgespräch buchen" required />
            </label>
            <label className="text-sm font-medium">Gewünschte Seiten *
              <input className={fieldClass} name="preferred_pages" placeholder="Start, Leistung, Über mich ..." required />
            </label>
            <label className="text-sm font-medium">Bestehende Assets
              <input className={fieldClass} name="existing_assets" placeholder="Logo, Fotos, Texte, Branding" />
            </label>
            <label className="text-sm font-medium">Domain / Hosting
              <input className={fieldClass} name="domain_access" placeholder="Vorhanden oder neu benötigt" />
            </label>
            <label className="text-sm font-medium">Terminbuchungs-Link
              <input className={fieldClass} type="url" name="booking_link" placeholder="https://" />
            </label>
            <label className="text-sm font-medium">Visuelle Richtung
              <input className={fieldClass} name="visual_direction" placeholder="Markenstil, Vorbilder, Farben" />
            </label>
          </div>
          <label className="block text-sm font-medium">Weitere Hinweise
            <textarea className={fieldClass} name="additional_notes" rows={3} />
          </label>
        </div>
        {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="mt-9 w-full rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white disabled:opacity-50">
          {pending ? "Briefing wird gespeichert..." : "Briefing verbindlich einreichen"}
        </button>
      </form>
    </div>
  );
}
