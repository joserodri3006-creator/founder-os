"use client";

import Script from "next/script";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string;
    };
  }
}

type Result = {
  submission_id: string;
  status: "checkout_ready" | "call_recommended";
  score: number;
  reason: string;
  preview?: boolean;
};

const fieldClass = "mt-2 w-full rounded-xl border border-[#DED7C9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1B2A5E]";
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL || "mailto:info@onlinefirst.eu?subject=Erstgespraech%20Authority%20Website%20Sprint";
const previewMode = process.env.NEXT_PUBLIC_ONLINE_FIRST_PREVIEW_MODE === "true";

export default function FitPage() {
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaRendered = useRef(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [b2bConfirmed, setB2bConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function renderCaptcha() {
    if (siteKey && captchaRef.current && window.turnstile && !captchaRendered.current) {
      captchaRendered.current = true;
      window.turnstile.render(captchaRef.current, { sitekey: siteKey, callback: setTurnstileToken });
    }
  }

  async function submitFit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    const payload = {
      first_name: form.get("first_name"),
      last_name: form.get("last_name"),
      email: form.get("email"),
      company_name: form.get("company_name"),
      website: form.get("website"),
      profession: form.get("profession"),
      offer_description: form.get("offer_description"),
      target_audience: form.get("target_audience"),
      offer_price_range: form.get("offer_price_range"),
      acquisition_channel: form.get("acquisition_channel"),
      website_status: form.get("website_status"),
      primary_goal: form.get("primary_goal"),
      funnel_preference: form.get("funnel_preference"),
      timeline: form.get("timeline"),
      pages_required: form.get("pages_required"),
      assets_status: form.get("assets_status"),
      budget_readiness: form.get("budget_readiness"),
      biggest_challenge: form.get("biggest_challenge"),
      needs_shop: form.get("needs_shop") === "on",
      needs_custom_features: form.get("needs_custom_features") === "on",
      privacy_consent: form.get("privacy_consent") === "on",
      marketing_consent: form.get("marketing_consent") === "on",
      website_confirmation: form.get("website_confirmation"),
      turnstile_token: turnstileToken,
      attribution: {
        utm_source: params.get("utm_source") ?? undefined,
        utm_medium: params.get("utm_medium") ?? undefined,
        utm_campaign: params.get("utm_campaign") ?? undefined,
        utm_content: params.get("utm_content") ?? undefined,
        utm_term: params.get("utm_term") ?? undefined,
        landing_page: window.location.pathname,
      },
    };

    const response = await fetch("/api/public/fit-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Der Projekt-Fit konnte nicht abgeschlossen werden.");
    } else {
      setResult(data);
    }
    setPending(false);
  }

  async function startCheckout() {
    if (!result) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/public/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: result.submission_id,
        terms_accepted: termsAccepted,
        b2b_confirmed: b2bConfirmed,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Der Checkout konnte nicht gestartet werden.");
      setPending(false);
      return;
    }
    window.location.assign(data.checkout_url);
  }

  return (
    <div className="min-h-screen bg-[#F8F7F2] px-6 py-8 text-[#14193A]">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={renderCaptcha} />}
      <div className="mx-auto max-w-3xl">
        <Link href="/online-first" className="text-sm text-[#536079]">← Zurück zum Angebot</Link>
        {previewMode && (
          <p className="mt-6 rounded-xl border border-[#E5DDCE] bg-[#FFF8EA] p-4 text-sm text-[#7A5C25]">
            Vorschau: Der Projekt-Fit zeigt das Routing, speichert aber keine Kundendaten und startet keine Zahlung.
          </p>
        )}
        <div className="mt-8 rounded-3xl border border-[#E5DDCE] bg-white p-6 shadow-sm sm:p-10">
          {!result ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A07840]">Projekt-Fit</p>
              <h1 className="mt-4 font-serif text-4xl font-light">Ist das Paket der richtige Start?</h1>
              <p className="mt-4 text-sm leading-7 text-[#536079]">
                In wenigen Minuten prüfen wir, ob der Authority Website Sprint zu Angebot,
                Zielgruppe und gewünschtem Anfrageprozess passt.
              </p>
              <form className="mt-9 space-y-6" onSubmit={submitFit}>
                <input className="hidden" name="website_confirmation" tabIndex={-1} autoComplete="off" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Vorname *
                    <input className={fieldClass} name="first_name" required />
                  </label>
                  <label className="text-sm font-medium">Nachname *
                    <input className={fieldClass} name="last_name" required />
                  </label>
                  <label className="text-sm font-medium">Geschäftliche E-Mail *
                    <input className={fieldClass} type="email" name="email" required />
                  </label>
                  <label className="text-sm font-medium">Unternehmen / Marke
                    <input className={fieldClass} name="company_name" />
                  </label>
                </div>
                <div className="border-t border-[#EEE8DC] pt-6">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A07840]">Angebot und Zielgruppe</p>
                  <div className="space-y-5">
                    <label className="block text-sm font-medium">Was bieten Sie an? *
                      <textarea className={`${fieldClass} min-h-24 resize-y`} name="offer_description" required placeholder="Zum Beispiel: Führungskräfte-Coaching für neue Teamleiter" />
                    </label>
                    <label className="block text-sm font-medium">Wer ist Ihre Zielgruppe? *
                      <textarea className={`${fieldClass} min-h-24 resize-y`} name="target_audience" required placeholder="Für wen ist Ihr Angebot konkret gedacht?" />
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Tätigkeit *
                    <select className={fieldClass} name="profession" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="consultant">Berater/in</option>
                      <option value="coach">Coach</option>
                      <option value="other">Andere Dienstleistung</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Preisrahmen Ihres Angebots *
                    <select className={fieldClass} name="offer_price_range" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="under_1000">Unter 1.000 EUR</option>
                      <option value="1000_to_3000">1.000 bis 3.000 EUR</option>
                      <option value="3000_to_10000">3.000 bis 10.000 EUR</option>
                      <option value="over_10000">Über 10.000 EUR</option>
                      <option value="varies">Variiert / noch offen</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Wie gewinnen Sie aktuell Anfragen? *
                    <select className={fieldClass} name="acquisition_channel" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="referrals">Empfehlungen</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="ads">Ads</option>
                      <option value="website">Bestehende Website / SEO</option>
                      <option value="mixed">Mehrere Kanäle</option>
                      <option value="none">Noch keine verlässliche Quelle</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Haben Sie bereits eine Website? *
                    <select className={fieldClass} name="website_status" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="live_needs_update">Ja, sie soll überarbeitet werden</option>
                      <option value="live_replace">Ja, sie soll ersetzt werden</option>
                      <option value="none">Nein, noch nicht</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium">Website-Adresse, falls vorhanden
                  <input className={fieldClass} type="url" name="website" placeholder="https://" />
                </label>
                <div className="border-t border-[#EEE8DC] pt-6">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A07840]">Ziel und Umsetzung</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Hauptziel *
                    <select className={fieldClass} name="primary_goal" required defaultValue="lead_generation">
                      <option value="lead_generation">Mehr qualifizierte Anfragen</option>
                      <option value="positioning">Positionierung verbessern</option>
                      <option value="launch">Neues Angebot launchen</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Kontakt oder Terminbuchung? *
                    <select className={fieldClass} name="funnel_preference" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="contact_form">Qualifiziertes Kontaktformular</option>
                      <option value="booking">Direkte Terminbuchung</option>
                      <option value="both">Beides kombiniert</option>
                      <option value="unsure">Noch offen</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Wann soll die Website online sein? *
                    <select className={fieldClass} name="timeline" required defaultValue="within_60_days">
                      <option value="within_30_days">Innerhalb von 30 Tagen</option>
                      <option value="within_60_days">Innerhalb von 60 Tagen</option>
                      <option value="later">Später / noch offen</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Benötigter Umfang *
                    <select className={fieldClass} name="pages_required" required defaultValue="up_to_5">
                      <option value="up_to_5">Bis zu 5 Seiten</option>
                      <option value="more_than_5">Mehr als 5 Seiten</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Texte, Bilder oder Branding *
                    <select className={fieldClass} name="assets_status" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="ready">Bereits weitgehend vorhanden</option>
                      <option value="partial">Teilweise vorhanden</option>
                      <option value="needed">Muss noch entwickelt werden</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Budget ab 2.490 EUR netto *
                    <select className={fieldClass} name="budget_readiness" required defaultValue="">
                      <option value="" disabled>Bitte wählen</option>
                      <option value="confirmed">Ist grundsätzlich eingeplant</option>
                      <option value="clarify">Muss noch abgestimmt werden</option>
                      <option value="not_planned">Ist aktuell nicht eingeplant</option>
                    </select>
                  </label>
                  </div>
                </div>
                <label className="block text-sm font-medium">Was ist aktuell die größte Herausforderung mit Ihrer Website oder Online-Präsenz? *
                  <textarea className={`${fieldClass} min-h-28 resize-y`} name="biggest_challenge" required />
                </label>
                <div className="space-y-3 rounded-xl bg-[#F8F7F2] p-5 text-sm">
                  <label className="flex gap-3"><input type="checkbox" name="needs_shop" /> Ich benötige Shop- oder Zahlungsfunktionen auf der Website.</label>
                  <label className="flex gap-3"><input type="checkbox" name="needs_custom_features" /> Ich benötige spezielle Integrationen oder individuelle Funktionen.</label>
                </div>
                <div className="space-y-3 text-sm">
                  <label className="flex gap-3">
                    <input type="checkbox" name="privacy_consent" required />
                    <span>Ich akzeptiere die Datenschutzhinweise zur Bearbeitung meiner Anfrage. *</span>
                  </label>
                  <label className="flex gap-3">
                    <input type="checkbox" name="marketing_consent" />
                    <span>Ich möchte passende Informationen per E-Mail erhalten und kann jederzeit widersprechen.</span>
                  </label>
                </div>
                {siteKey && <div ref={captchaRef} />}
                {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
                <button disabled={pending} className="w-full rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white disabled:opacity-60">
                  {pending ? "Wird geprüft..." : "Projekt-Fit prüfen"}
                </button>
              </form>
            </>
          ) : result.status === "checkout_ready" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-700">Passendes Projekt</p>
              <h1 className="mt-4 font-serif text-4xl font-light">Sie können direkt starten.</h1>
              <p className="mt-5 text-[#536079]">{result.reason}</p>
              <div className="mt-8 rounded-2xl bg-[#F8F7F2] p-6">
                <p className="font-semibold">Authority Website Sprint</p>
                <p className="mt-2 text-sm text-[#536079]">
                  4 verkaufsrelevante Seiten, Pflichtseiten-Struktur und Kontakt- oder Termin-Funnel
                </p>
                <p className="mt-3 text-sm text-[#536079]">Gesamtpreis: 2.490 EUR netto zzgl. USt.</p>
                <p className="mt-5 font-serif text-3xl">1.245 EUR netto</p>
                <p className="text-sm text-[#536079]">Anzahlung jetzt, Restzahlung nach Abnahme</p>
              </div>
              <div className="mt-8 space-y-4 text-sm">
                <label className="flex gap-3">
                  <input type="checkbox" checked={b2bConfirmed} onChange={(event) => setB2bConfirmed(event.target.checked)} />
                  <span>Ich handle als Unternehmer/in und beauftrage dieses Projekt für mein Geschäft.</span>
                </label>
                <label className="flex gap-3">
                  <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                  <span>
                    Ich akzeptiere Leistungsbeschreibung, AGB und Zahlungsbedingungen.{" "}
                    <Link href="/online-first/rechtliches" className="underline">Dokumente ansehen</Link>
                  </span>
                </label>
              </div>
              {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
              <button
                disabled={pending || !termsAccepted || !b2bConfirmed || result.preview}
                onClick={startCheckout}
                className="mt-8 w-full rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white disabled:opacity-50"
              >
                {result.preview
                  ? "Checkout im Vorschaumodus deaktiviert"
                  : pending
                    ? "Checkout wird geladen..."
                    : "Verbindlich starten und Anzahlung leisten"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A07840]">Persönliche Klärung empfohlen</p>
              <h1 className="mt-4 font-serif text-4xl font-light">Lassen Sie uns den Umfang kurz klären.</h1>
              <p className="mt-5 leading-7 text-[#536079]">{result.reason}</p>
              <a href={bookingUrl} className="mt-9 inline-flex w-full justify-center rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white">
                Kostenloses Erstgespräch buchen
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
