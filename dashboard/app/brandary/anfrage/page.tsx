"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const fieldStyle: React.CSSProperties = {
  marginTop: 5,
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #D8DCEC",
  borderRadius: 12,
  padding: 10,
  fontSize: 15,
  background: "white",
  color: "#15172F",
  fontFamily: "Arial, sans-serif",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);

  function toggleNeed(value: string) {
    setNeed((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  }

  function postHeight() {
    // Measure only the actual content box, never document.documentElement.
    // document.documentElement.scrollHeight inside an iframe is circular with
    // the iframe's own assigned height (parent grows iframe -> viewport grows
    // -> scrollHeight grows -> parent grows iframe again), which causes an
    // unbounded runaway feedback loop. Measuring the fixed content wrapper's
    // own bounding height breaks that cycle. A hard cap is kept as a second
    // safety net in case any future change reintroduces circularity.
    const height = containerRef.current?.getBoundingClientRect().height;
    if (!height) return;
    const rounded = Math.min(Math.ceil(height), 2000);
    if (Math.abs(rounded - lastHeightRef.current) < 2) return; // no real change, stop the loop
    lastHeightRef.current = rounded;
    window.parent?.postMessage({ type: "brandary-form-height", height: rounded }, "*");
  }

  useEffect(() => {
    postHeight();
    const timers = [50, 200, 500, 1000].map((delay) => setTimeout(postHeight, delay));
    window.addEventListener("resize", postHeight);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(() => postHeight());
      observer.observe(containerRef.current);
    }

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", postHeight);
      observer?.disconnect();
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
      ref={containerRef}
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#FAFAFB",
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#FAFAFB",
          border: "1px solid #E3E6EF",
          borderRadius: 26,
          padding: 14,
          display: "grid",
          gap: 6,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <h3 style={{ fontSize: 16, margin: 0, color: "#15172F" }}>Nachricht schreiben</h3>

        {done ? (
          <p style={{ fontSize: 15, color: "#15172F", margin: 0 }}>{status}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 6 }}>
            <input
              type="text"
              name="website_url"
              autoComplete="off"
              tabIndex={-1}
              style={{ position: "absolute", left: -9999, opacity: 0 }}
              aria-hidden="true"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 6,
              }}
            >
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
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 6,
                alignItems: "start",
              }}
            >
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
                Termin
                <input
                  name="desired_date"
                  placeholder="Eventdatum / Monat"
                  style={fieldStyle}
                />
              </label>
              <label style={labelStyle}>
                Logo Link
                <input
                  name="logo_url"
                  placeholder="Drive / Dropbox Link"
                  style={fieldStyle}
                />
              </label>
              <div style={labelStyle}>
                Bedarf
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "3px 8px",
                    marginTop: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#5D6478",
                  }}
                >
                  {NEED_OPTIONS.map((option) => (
                    <label key={option} style={{ whiteSpace: "nowrap" }}>
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
            </div>
            <label style={labelStyle}>
              Nachricht
              <textarea
                name="message"
                rows={2}
                required
                placeholder="Menge, Produkt, gewünschte Veredelung"
                style={{ ...fieldStyle, lineHeight: 1.3, marginTop: 4 }}
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
                padding: "9px 20px",
                fontSize: 14,
                fontWeight: 800,
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Wird gesendet..." : "Projekt anfragen"}
            </button>
            <p style={{ fontSize: 11, color: "#5D6478", margin: 0 }}>{status}</p>
          </form>
        )}
      </div>
    </div>
  );
}
