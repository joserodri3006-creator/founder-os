"use client";

import { use, useEffect, useState } from "react";

type Invitation = { venture: string; customer_name: string | null; order_title: string | null };

const CATEGORIES: Array<[string, string]> = [["quality", "Qualität"], ["communication", "Kommunikation"], ["delivery", "Lieferung"]];

function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} Sterne`} onClick={() => onChange(n)}
          className="text-3xl leading-none" style={{ color: n <= value ? "#C8A96E" : "#D1D5DB" }}>★</button>
      ))}
    </div>
  );
}

export default function BewertenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/reviews/${token}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "Einladung nicht verfügbar.");
      else { setInvite(d); setName(d.customer_name ?? ""); }
    }).catch(() => setError("Einladung konnte nicht geladen werden."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch(`/api/public/reviews/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, title, body, author_name: name, public_consent: consent, category_ratings: categories }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Bewertung konnte nicht gesendet werden.");
    else setDone(true);
  }

  return (
    <main className="min-h-screen bg-[#F7F5F0] flex items-start justify-center p-4 md:p-10">
      <div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-6 md:p-8">
        <p className="text-xs tracking-[0.2em] text-gray-500 mb-2">BLAZED OUTFITTERS</p>
        {done ? (
          <>
            <h1 className="text-2xl font-semibold mb-3">Vielen Dank für Ihre Bewertung</h1>
            <p className="text-gray-600">Wir lesen jede Rückmeldung persönlich. {consent ? "Ihre Bewertung wird nach einer kurzen Prüfung veröffentlicht." : "Ihre Bewertung bleibt intern und wird nicht veröffentlicht."}</p>
          </>
        ) : !invite ? (
          <p className="text-gray-600">{error || "Lade …"}</p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Wie war Ihre Erfahrung?</h1>
              <p className="text-sm text-gray-600">Ihre ehrliche Meinung hilft uns – positiv, neutral oder kritisch. Es gibt keine Belohnung für Bewertungen.</p>
              {invite.order_title && <p className="text-xs text-gray-500 mt-2">Zu Ihrer Bestellung: {invite.order_title}</p>}
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Gesamtbewertung *</p>
              <StarInput value={rating} onChange={setRating} label="Gesamtbewertung" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CATEGORIES.map(([key, label]) => (
                <div key={key}>
                  <p className="text-xs text-gray-600 mb-1">{label} (optional)</p>
                  <div role="radiogroup" aria-label={label} className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={categories[key] === n} aria-label={`${label}: ${n} Sterne`}
                        onClick={() => setCategories((c) => ({ ...c, [key]: n }))} className="text-xl leading-none" style={{ color: n <= (categories[key] ?? 0) ? "#C8A96E" : "#D1D5DB" }}>★</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="title">Überschrift (optional)</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="body">Ihre Erfahrung *</label>
              <textarea id="body" required value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="name">Name (öffentlich gekürzt, z. B. „Anna M.“)</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm" />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              <span>Meine Bewertung darf nach Prüfung öffentlich auf der Website von Blazed Outfitters erscheinen (mit gekürztem Namen).</span>
            </label>
            <p className="text-xs text-gray-500">Mit dem Absenden stimme ich der Speicherung meiner Bewertung zur Qualitätssicherung zu. E-Mail-Adresse und Bestelldaten werden nicht veröffentlicht.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy || rating < 1 || !body.trim()} className="w-full py-2.5 rounded-md bg-gray-900 text-white font-medium disabled:opacity-40">{busy ? "Sende …" : "Bewertung absenden"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
