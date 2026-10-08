"use client";

import { useState } from "react";
import type { VentureBranding } from "@/lib/venture-branding";

type Props = {
  token: string;
  branding: VentureBranding;
  customerName: string | null;
  orderTitle: string | null;
  products: Array<{ product_id: string; product_name: string }>;
};

const CATEGORIES: Array<[string, string]> = [
  ["quality", "Qualität"],
  ["communication", "Kommunikation"],
  ["delivery", "Lieferung"],
];

function t(b: VentureBranding, du: string, sie: string) {
  return b.address === "du" ? du : sie;
}

function Stars({
  value, onChange, label, size, b,
}: { value: number; onChange: (v: number) => void; label: string; size: number; b: VentureBranding }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "Stern" : "Sterne"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: size > 24 ? 4 : 2,
            fontSize: size, lineHeight: 1, color: n <= shown ? b.colors.star : b.colors.starOff,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewForm({ token, branding: b, customerName, orderTitle, products }: Props) {
  const c = b.colors;
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [name, setName] = useState(customerName ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const input: React.CSSProperties = {
    width: "100%", marginTop: 6, padding: "10px 12px", fontSize: 15, fontFamily: b.fonts.body,
    background: "#FFFFFF80", color: c.ink, border: `1px solid ${c.border}`, borderRadius: 2, outline: "none",
  };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: c.ink, letterSpacing: "0.02em" };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/reviews/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title, body, author_name: name, public_consent: consent, category_ratings: categories, product_ratings: Object.entries(productRatings).map(([product_id, r]) => ({ product_id, rating: r })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Die Bewertung konnte nicht gesendet werden.");
      else setDone(true);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <div style={{ fontSize: 40, color: c.star, lineHeight: 1 }} aria-hidden="true">★</div>
        <h2 style={{ fontFamily: b.fonts.heading, fontStyle: "italic", fontWeight: 500, fontSize: 32, margin: "12px 0 8px", color: c.ink }}>
          {t(b, "Danke dir!", "Vielen Dank!")}
        </h2>
        <p style={{ color: c.muted, lineHeight: 1.6, margin: "0 auto 24px", maxWidth: 420 }}>
          {t(b, "Wir lesen jede Rückmeldung persönlich. ", "Wir lesen jede Rückmeldung persönlich. ")}
          {consent
            ? t(b, "Deine Bewertung erscheint nach einer kurzen Prüfung auf unserer Website.", "Ihre Bewertung erscheint nach einer kurzen Prüfung auf unserer Website.")
            : t(b, "Deine Bewertung bleibt intern und wird nicht veröffentlicht.", "Ihre Bewertung bleibt intern und wird nicht veröffentlicht.")}
        </p>
        <a href={b.siteUrl} style={{ display: "inline-block", padding: "12px 28px", background: c.accent, color: c.accentText, textDecoration: "none", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Zurück zu {b.name}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 22 }}>
      {orderTitle && (
        <p style={{ margin: 0, fontSize: 13, color: c.muted }}>
          {t(b, "Zu deiner Bestellung", "Zu Ihrer Bestellung")}: <strong style={{ color: c.ink, fontWeight: 500 }}>{orderTitle}</strong>
        </p>
      )}

      <div>
        <div style={label}>{t(b, "Deine Gesamtbewertung", "Ihre Gesamtbewertung")} *</div>
        <div style={{ marginTop: 6 }}>
          <Stars value={rating} onChange={setRating} label="Gesamtbewertung" size={36} b={b} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        {CATEGORIES.map(([key, text]) => (
          <div key={key}>
            <div style={{ fontSize: 12, color: c.muted }}>{text} <span style={{ opacity: 0.7 }}>(optional)</span></div>
            <Stars value={categories[key] ?? 0} onChange={(v) => setCategories((s) => ({ ...s, [key]: v }))} label={text} size={22} b={b} />
          </div>
        ))}
      </div>

      {products.length > 0 && (
        <div>
          <div style={label}>{t(b, "Wie gefallen dir die Produkte?", "Wie gefallen Ihnen die Produkte?")} <span style={{ color: c.muted, fontWeight: 400 }}>(optional)</span></div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {products.map((p) => (
              <div key={p.product_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: c.ink }}>{p.product_name}</span>
                <Stars value={productRatings[p.product_id] ?? 0} onChange={(v) => setProductRatings((s) => ({ ...s, [p.product_id]: v }))} label={p.product_name} size={22} b={b} />
              </div>
            ))}
          </div>
        </div>
      )}

      <label style={label}>
        {t(b, "Überschrift", "Überschrift")} <span style={{ color: c.muted, fontWeight: 400 }}>(optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} style={input} />
      </label>

      <label style={label}>
        {t(b, "Deine Erfahrung", "Ihre Erfahrung")} *
        <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} style={{ ...input, resize: "vertical" }}
          placeholder={t(b, "Was hat dir gefallen, was können wir besser machen?", "Was hat Ihnen gefallen, was können wir besser machen?")} />
      </label>

      <label style={label}>
        {t(b, "Dein Name", "Ihr Name")} <span style={{ color: c.muted, fontWeight: 400 }}>({t(b, "öffentlich gekürzt, z. B. „Anna M.“", "öffentlich gekürzt, z. B. „Anna M.“")})</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} style={input} />
      </label>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: c.ink, lineHeight: 1.5 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4, accentColor: c.accent }} />
        <span>
          {t(b, `Meine Bewertung darf nach Prüfung öffentlich auf der Website von ${b.name} erscheinen (mit gekürztem Namen).`,
                `Meine Bewertung darf nach Prüfung öffentlich auf der Website von ${b.name} erscheinen (mit gekürztem Namen).`)}
        </span>
      </label>

      <p style={{ margin: 0, fontSize: 12, color: c.muted, lineHeight: 1.5 }}>
        {t(b, "E-Mail-Adresse und Bestelldaten werden nie veröffentlicht. Mit dem Absenden stimmst du der Speicherung deiner Bewertung zur Qualitätssicherung zu.",
              "E-Mail-Adresse und Bestelldaten werden nie veröffentlicht. Mit dem Absenden stimmen Sie der Speicherung Ihrer Bewertung zur Qualitätssicherung zu.")}
      </p>

      {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: c.danger }}>{error}</p>}

      <button
        disabled={busy || rating < 1 || !body.trim()}
        style={{
          padding: "14px 24px", background: c.accent, color: c.accentText, border: "none", cursor: "pointer",
          fontFamily: b.fonts.body, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
          opacity: busy || rating < 1 || !body.trim() ? 0.45 : 1,
        }}
      >
        {busy ? "Wird gesendet …" : "Bewertung absenden"}
      </button>
    </form>
  );
}
