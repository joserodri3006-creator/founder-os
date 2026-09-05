"use client";

import { FormEvent, useEffect, useState } from "react";

const fieldStyle: React.CSSProperties = {
  marginTop: 6,
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #D8DCEC",
  borderRadius: 14,
  padding: 13,
  fontSize: 16,
  background: "white",
  color: "#15172F",
  fontFamily: "Arial, sans-serif",
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#15172F",
  display: "block",
};

const NEED_OPTIONS = ["Textilien", "Gravur", "Merch", "Werbemittel"];
const QUANTITY_OPTIONS = ["10 bis 25", "25 bis 50", "50 bis 100", "100 plus"];

export default function BrandaryAnfrageFormular() {
  const [need, setNeed] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(
    "Die Anfrage wird in Brandary Leads gespeichert und per E Mail bestätigt."
  );
  const [done, setDone] = useState(false);

  function toggleNeed(value: string) {
    setNeed((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  }

  function postHeight() {
    // Inform the embedding page (Brandary website) of the current height,
    // so the iframe can size itself instead of showing scrollbars.
    const height = document.documentElement.scrollHeight;
    window.parent?.postMessage({ type: "brandary-form-height", height }, "*");
  }

  useEffect(() => {
    postHeight();
    const timer = setTimeout(postHeight, 200);
    window.addEventListener("resize", postHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", postHeight);
    };
  }, [need, done, pending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("Anfrage wird gesendet.");
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: data.get("name"),
      company_name: data.get("company_name"),
      email: data.get("email"),
      phone: data.get("phone"),
      need,
      quantity: data.get("quantity"),
      desired_date: data.get("desired_date"),
      logo_url: data.get("logo_url"),
      message: data.get("message"),
      website_url: data.get("website_url"),
    };

    try {
      const response = await fetch("/api/public/brandary-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Die Anfrage konnte nicht gesendet werden.");
      }
      form.reset();
      setNeed([]);
      setDone(true);
      setStatus("Danke. Ihre Anfrage wurde gespeichert und per E Mail bestätigt.");
    } catch (error) {
      setStatus(
        (error instanceof Error ? error.message : "Unbekannter Fehler.") +
          " Bitte schreiben Sie direkt an info@bybrandary.de."
      );
    } finally {
      setPending(false);
      setTimeout(postHeight, 50);
    }
  }

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#FAFAFB",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#FAFAFB",
          border: "1px solid #E3E6EF",
          borderRadius: 26,
          padding: 24,
          display: "grid",
          gap: 14,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <h3 style={{ fontSize: 20, margin: 0, color: "#15172F" }}>Nachricht schreiben</h3>
        <p style={{ fontSize: 16, color: "#5D6478", margin: 0 }}>
          Ideal sind kurze Angaben zu Menge, Termin, Produkt oder Produktidee, gewünschter
          Veredelung und ein Logo oder Datei Link.
        </p>

        {done ? (
          <p style={{ fontSize: 15, color: "#15172F", margin: 0 }}>{status}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <input
              type="text"
              name="website_url"
              autoComplete="off"
              tabIndex={-1}
              style={{ position: "absolute", left: -9999, opacity: 0 }}
              aria-hidden="true"
            />
            <label style={labelStyle}>
              Name
              <input name="name" required style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Unternehmen
              <input name="company_name" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              E Mail
              <input type="email" name="email" required style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Telefon
              <input name="phone" style={fieldStyle} />
            </label>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#15172F" }}>
              Was benötigen Sie?
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 8,
                  marginTop: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#5D6478",
                }}
              >
                {NEED_OPTIONS.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={need.includes(option)}
                      onChange={() => toggleNeed(option)}
                    />{" "}
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <label style={labelStyle}>
              Stückzahl
              <select name="quantity" required style={fieldStyle}>
                <option value="">Bitte auswählen</option>
                {QUANTITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Gewünschter Termin
              <input
                name="desired_date"
                placeholder="Zum Beispiel Eventdatum oder Wunschmonat"
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              Logo oder Datei Link
              <input
                name="logo_url"
                placeholder="Drive, Dropbox oder WeTransfer Link"
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              Nachricht
              <textarea
                name="message"
                rows={5}
                required
                style={{ ...fieldStyle, lineHeight: 1.5 }}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              style={{
                border: 0,
                background: "#151B4A",
                color: "white",
                borderRadius: 999,
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 800,
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Wird gesendet..." : "Projekt anfragen"}
            </button>
            <p style={{ fontSize: 13, color: "#5D6478", margin: 0 }}>{status}</p>
          </form>
        )}
      </div>
    </div>
  );
}
