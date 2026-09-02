"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useVenture } from "@/context/VentureContext";

type Status = "passed" | "failed" | "skipped";

type TestResult = {
  title: string;
  suite: string;
  file: string;
  line: number | null;
  status: Status;
  durationMs: number;
  error?: string;
  skipReason?: string;
};

type QaStatus = {
  runnerEnabled: boolean;
  testDir: string;
  exists: boolean;
  latest: null | {
    stats: { total: number; passed: number; failed: number; skipped: number; durationMs: number; startTime: string | null };
    results: TestResult[];
  };
};

const TEST_STEPS: Record<string, string[]> = {
  "login page exposes email/password/password-reset/register and rejects missing credentials": ["/b2b/login mit Preview öffnen", "Portal-Text prüfen", "E-Mail-/Passwortfeld prüfen", "Anmelden, Passwort-Reset und Registrierung prüfen"],
  "registration page exposes required business access fields": ["/b2b/register öffnen", "B2B-Zugangstext prüfen", "Vorname, Nachname, Unternehmen, E-Mail, Passwort prüfen", "Button Zugang anfragen prüfen"],
  "dashboard is protected without session": ["/b2b/dashboard ohne Session öffnen", "Redirect auf Login erwarten", "Partner-Portal sichtbar prüfen"],
  "customer can add product to cart and reach checkout with correct totals": ["Preview-Shop öffnen", "Produkt Teller rund öffnen", "In Warenkorb legen", "Warenkorb öffnen", "Zur Kasse klicken", "Gesamtbetrag und Zahlungsbereich prüfen"],
  "pickup/bar checkout form is fillable and shows free pickup total before submit": ["Produkt in Warenkorb legen", "Kasse öffnen", "Abholung wählen", "Test-Kontaktdaten eintragen", "Kostenlosen Versand und Gesamt 29,90 € prüfen"],
  "bar checkout API creates Founder OS order and cleanup can cancel it": ["RUN_SIDE_EFFECTS=1", "POST /api/checkout/bar", "Order-ID erwarten", "Testorder notieren", "Testorder automatisch stornieren"],
  "pickup/bar UI redirects to order success page after creating order": ["RUN_SIDE_EFFECTS=1", "Produkt in Warenkorb legen", "Abholung/Kontaktdaten ausfüllen", "Bestellung vormerken", "Erfolgseite erwarten", "Testorder stornieren"],
  "active Founder OS products match the visible B2C shop assortment": ["Aktive Produkte aus Founder OS lesen", "6 aktive Produkte prüfen", "Slug, Preis, Gewicht, Bilder prüfen", "Produktnamen im Shop prüfen"],
  "categories exist and reveal empty live categories before launch": ["Kategorien aus Founder OS lesen", "Produkt-Kategorie-Maps auswerten", "Aktive Produkte je Kategorie zählen", "Leere Kategorien sichtbar dokumentieren"],
  "recent Itaba orders have invoice numbers and expose current invoice generation gap": ["Aktuelle Itaba-Orders lesen", "IT-Rechnungsnummer prüfen", "Order-Wert prüfen", "invoice_generated_at prüfen", "invoice_html prüfen"],
  "returns table contains processable Itaba returns": ["Itaba-Retouren lesen", "Order-ID und Kunden-E-Mail prüfen", "Items prüfen", "Retourenstatus prüfen"],
  "preview shop loads, exposes expected active products, and has no JS errors": ["Preview-Shop öffnen", "Cookies behandeln", "Seitentitel prüfen", "6 Produktnamen prüfen", "Console-Errors prüfen"],
  "all active product detail pages expose price, VAT, shipping, weight and add-to-cart": ["Alle Produktlinks sammeln", "Jede Produktseite öffnen", "MwSt., Versand, Gewicht prüfen", "Warenkorb-Button prüfen"],
  "service and legal pages are reachable and contain core information": ["Service-Seiten öffnen", "Rechtstexte öffnen", "Kerntexte und Kontaktdaten prüfen"],
  "robots and sitemap contain expected public/private routes": ["robots.txt abrufen", "Private Pfade prüfen", "sitemap.xml abrufen", "Shop-/Produkt-URLs prüfen"],
  "tracking and return lookup reject unknown orders cleanly": ["Fake-Order in Sendungsverfolgung prüfen", "404 JSON erwarten", "Fake-Order in Retoure prüfen", "404 JSON erwarten"],
  "tracking and return lookup find a real marked pickup order": ["RUN_SIDE_EFFECTS=1", "Testorder erzeugen", "Sendungsverfolgung prüfen", "Retoure-Lookup prüfen", "Testorder stornieren"],
  "return request can be created for a real marked order": ["RUN_SIDE_EFFECTS=1", "Testorder erzeugen", "Retoure POST senden", "ok=true erwarten", "Testorder stornieren"],
  "contact form validates invalid input": ["Kontaktseite öffnen", "Ohne Eingaben absenden", "Browser/Formularvalidierung erwarten"],
  "contact form can send marked test message": ["RUN_SIDE_EFFECTS=1", "Kontaktformular mit Testmarkierung ausfüllen", "Absenden", "Erfolgsmeldung erwarten"],
};

const STATUS_LABEL: Record<Status, string> = { passed: "Bestanden", failed: "Fehlgeschlagen", skipped: "Optional" };

function areaFor(result: TestResult) {
  if (result.suite.includes("B2B")) return "B2B";
  if (result.suite.includes("B2C")) return "B2C Checkout";
  if (result.suite.includes("Founder")) return "Founder OS Daten";
  if (result.suite.includes("public")) return "Shop & Content";
  if (result.suite.includes("service")) return "Service-Flows";
  return "Weitere";
}

function statusClasses(status: Status) {
  if (status === "passed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function QaTestsPage() {
  const { user, loading: authLoading } = useAuth();
  const { venture } = useVenture();
  const [data, setData] = useState<QaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<"normal" | "side-effects" | null>(null);
  const [filter, setFilter] = useState("Alle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch("/api/qa/itaba-playwright", { cache: "no-store" });
    setData(await res.json());
    setLoading(false);
  }

  async function run(mode: "normal" | "side-effects") {
    setRunning(mode);
    setMessage(null);
    const res = await fetch("/api/qa/itaba-playwright", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const json = await res.json();
    setMessage(json.ok ? "Testlauf abgeschlossen." : (json.error ?? "Testlauf mit Fehlern abgeschlossen."));
    setData(json.latest ? { ...(data ?? {} as QaStatus), latest: json.latest, runnerEnabled: data?.runnerEnabled ?? false, testDir: data?.testDir ?? "", exists: data?.exists ?? false } : data);
    setRunning(null);
  }

  useEffect(() => { loadStatus().catch(() => setLoading(false)); }, []);

  const results = data?.latest?.results ?? [];
  const areas = useMemo(() => ["Alle", ...Array.from(new Set(results.map(areaFor)))], [results]);
  const filtered = results.filter(r => {
    const areaMatch = filter === "Alle" || areaFor(r) === filter;
    const q = query.toLowerCase();
    const text = `${r.title} ${r.suite} ${r.file} ${r.error ?? ""}`.toLowerCase();
    return areaMatch && text.includes(q);
  });

  if (authLoading || loading) return <div className="p-8 text-sm text-gray-400">Laden…</div>;
  if (!user) return <div className="p-8 text-sm text-gray-500">Bitte einloggen.</div>;
  if (venture !== "online_first") {
    return <div className="p-8 max-w-2xl"><div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-600">QA-Tests sind aktuell für <b>Online First</b> eingerichtet. Bitte links Venture „Online First“ wählen.</div></div>;
  }

  const stats = data?.latest?.stats ?? { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, startTime: null };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-blue-700">Online First · QA</p>
          <h1 className="text-2xl font-semibold text-gray-950 mt-1">Playwright Testcenter</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-3xl">Wiederholbare Abnahmetests für den Itaba-Shop: Shop, B2C Checkout, B2B-Oberflächen, Service-Flows und Founder-OS-Datenprüfung.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run("normal")} disabled={!!running || !data?.runnerEnabled} className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-40" style={{ background: "#1B2A5E" }}>{running === "normal" ? "Läuft…" : "Read-only Tests starten"}</button>
          <button onClick={() => run("side-effects")} disabled={!!running || !data?.runnerEnabled} className="px-4 py-2 rounded-md text-sm font-medium border border-amber-300 text-amber-800 bg-amber-50 disabled:opacity-40">{running === "side-effects" ? "Läuft…" : "Echte Testdaten auslösen"}</button>
        </div>
      </div>

      {!data?.runnerEnabled && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">Runner ist auf diesem Deployment deaktiviert. Lokal aktivieren mit <code className="bg-white px-1.5 py-0.5 rounded">QA_ALLOW_LOCAL_RUNNER=1</code>. Testverzeichnis: <code className="bg-white px-1.5 py-0.5 rounded">{data?.testDir}</code></div>
      )}
      {message && <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">{message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Metric label="Testfälle" value={stats.total} />
        <Metric label="Bestanden" value={stats.passed} tone="ok" />
        <Metric label="Fehlgeschlagen" value={stats.failed} tone="bad" />
        <Metric label="Optional" value={stats.skipped} tone="skip" />
        <Metric label="Laufzeit" value={`${Math.round(stats.durationMs / 1000)}s`} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl mb-6 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {areas.map(area => <button key={area} onClick={() => setFilter(area)} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${filter === area ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"}`}>{area}</button>)}
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Testfall suchen…" className="ml-auto min-w-[260px] px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((r, index) => {
          const key = `${r.file}:${r.line}:${r.title}`;
          const isOpen = open === key || r.status === "failed";
          return (
            <div key={key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : key)} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                <span className="text-xs font-mono text-gray-400 w-12">TC-{index + 1}</span>
                <span className="flex-1"><span className="block text-sm font-semibold text-gray-900">{r.title}</span><span className="block text-xs text-gray-400 mt-0.5">{areaFor(r)} · {r.file}:{r.line} · {(r.durationMs / 1000).toFixed(1)}s</span></span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusClasses(r.status)}`}>{STATUS_LABEL[r.status]}</span>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4 grid md:grid-cols-2 gap-6">
                  <div><h3 className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">Testschritte</h3><ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">{(TEST_STEPS[r.title] ?? ["Siehe Testdatei für Details."]).map(step => <li key={step}>{step}</li>)}</ol></div>
                  <div><h3 className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">Testergebnis</h3><pre className={`text-xs whitespace-pre-wrap rounded-lg p-3 border ${statusClasses(r.status)}`}>{r.status === "passed" ? "Bestanden." : r.status === "skipped" ? (r.skipReason ?? "Optionaler Test; mit RUN_SIDE_EFFECTS=1 ausführbar.") : r.error}</pre></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "bad" | "skip" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : tone === "skip" ? "text-amber-700" : "text-gray-950";
  return <div className="bg-white border border-gray-200 rounded-xl px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</p><p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p></div>;
}
