"use client";

import { FormEvent, useState } from "react";

type SearchResult = {
  title: string;
  company_name: string;
  website: string;
  display_link: string;
  snippet: string;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
  filtered_count?: number;
};

type Candidate = SearchResult & {
  selected: boolean;
  first_name: string;
  last_name: string;
  email: string;
  city: string;
  contact_verified: boolean;
};

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const fieldClass = "w-full rounded-lg border border-[#D1D5E8] bg-white px-3 py-2 text-sm outline-none focus:border-[#1B2A5E]";

export default function GoogleLeadSearchModal({ onClose, onImported }: Props) {
  const [region, setRegion] = useState("Hessen");
  const [segment, setSegment] = useState("all");
  const [specialization, setSpecialization] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/leads/google-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, segment, specialization, limit: 10 }),
      });
      const data = await response.json() as SearchResponse & { error?: string };
      if (!response.ok) {
        setError(data.error || "Die Google-Suche konnte nicht ausgefuehrt werden.");
        setResults([]);
        return;
      }
      const filteredCount = data.filtered_count ?? 0;
      setQuery(data.query);
      setResults(
        data.results.map((result: SearchResult) => ({
          ...result,
          selected: false,
          first_name: "",
          last_name: "",
          email: "",
          city: "",
          contact_verified: false,
        }))
      );
      setMessage(
        data.results.length
          ? `${data.results.length} neue Kandidaten gefunden${filteredCount ? `, ${filteredCount} bereits gespeicherte Treffer ausgeblendet` : ""}. Bitte Kontaktangaben prüfen und passende Leads auswählen.`
          : filteredCount
            ? `Keine neuen Kandidaten gefunden. ${filteredCount} bereits gespeicherte Treffer wurden ausgeblendet.`
            : "Keine Kandidaten gefunden. Bitte Region oder Spezialisierung anpassen."
      );
    } catch {
      setError("Die Google-Suche ist aktuell nicht erreichbar. Bitte erneut versuchen.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function updateCandidate(index: number, patch: Partial<Candidate>) {
    setResults((current) => current.map((candidate, i) => (i === index ? { ...candidate, ...patch } : candidate)));
    setError("");
  }

  async function importSelected() {
    const selected = results.filter((candidate) => candidate.selected);
    if (selected.length === 0) {
      setError("Bitte mindestens einen Kandidaten auswählen.");
      return;
    }
    const incomplete = selected.find(
      (candidate) => !candidate.first_name.trim() || !candidate.last_name.trim() || !candidate.email.trim() || !candidate.contact_verified
    );
    if (incomplete) {
      setError("Für ausgewählte Kandidaten sind Ansprechpartner, geprüfte E-Mail und die Prüfbestätigung erforderlich.");
      return;
    }

    setImporting(true);
    setError("");
    let imported = 0;
    let duplicates = 0;
    try {
      for (const candidate of selected) {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venture: "online_first",
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            email: candidate.email,
            company_name: candidate.company_name,
            website: candidate.website,
            city: candidate.city,
            region,
            industry: segment === "consultants" ? "Beratung" : segment === "coaches" ? "Coaching" : "Coaching / Beratung / Expertise",
            source: "ki_suche",
            automation_enabled: false,
            contact_reason: `Google Search Recherche fuer Authority Website Sprint (${region})`,
            notes: [
              `Recherchequelle: Google Search (${query})`,
              `Gefundene URL: ${candidate.website}`,
              candidate.snippet ? `Suchauszug: ${candidate.snippet}` : "",
              "Kontaktangaben vor Import manuell geprüft.",
            ].filter(Boolean).join("\n"),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(`${imported} Leads wurden übernommen; ein weiterer Lead konnte nicht gespeichert werden: ${data.error || "Fehler"}`);
          return;
        }
        imported += 1;
        if (data.duplicate) duplicates += 1;
      }
      setMessage(`${imported} Leads ins CRM übernommen${duplicates ? `, davon ${duplicates} als Duplikat markiert` : ""}.`);
      setResults((current) => current.filter((candidate) => !candidate.selected));
      onImported();
    } catch {
      setError(`${imported} Leads wurden übernommen; die Verbindung ist beim Import abgebrochen.`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14193A]/55 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#D1D5E8] bg-[#F8F7F2] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5DDCE] bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A07840]">Akquise Recherche</p>
            <h2 className="mt-2 font-serif text-2xl font-light text-[#14193A]">Google Leads suchen</h2>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-[#6B7280]" aria-label="Schließen">×</button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={search} className="rounded-xl border border-[#E5DDCE] bg-white p-5">
            <p className="mb-5 rounded-lg bg-[#F2EFE8] px-4 py-3 text-sm text-[#536079]">
              Gefundene und geprüfte Leads werden dem Venture <strong>Online First</strong> für den Authority Website Sprint zugeordnet.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-[#14193A]">Region
                <input className={`mt-2 ${fieldClass}`} value={region} onChange={(event) => setRegion(event.target.value)} required placeholder="Hessen" />
              </label>
              <label className="text-sm font-medium text-[#14193A]">Zielgruppe
                <select className={`mt-2 ${fieldClass}`} value={segment} onChange={(event) => setSegment(event.target.value)}>
                  <option value="all">Coaches, Berater und Experten</option>
                  <option value="coaches">Coaches</option>
                  <option value="consultants">Berater</option>
                  <option value="experts">Experten</option>
                </select>
              </label>
              <label className="text-sm font-medium text-[#14193A]">Spezialisierung optional
                <input className={`mt-2 ${fieldClass}`} value={specialization} onChange={(event) => setSpecialization(event.target.value)} placeholder="z. B. Business Coach" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-2xl text-xs leading-6 text-[#6B7280]">
                Ergebnisse dienen der Recherche. Vor dem Import bitte geschäftliche Kontaktdaten auf der Website prüfen.
              </p>
              <button disabled={searching} className="rounded-lg bg-[#1B2A5E] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {searching ? "Google wird durchsucht..." : "Leads bei Google suchen"}
              </button>
            </div>
          </form>

          {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {message && <p className="mt-5 rounded-xl border border-[#DCE7DF] bg-white p-4 text-sm text-[#17734E]">{message}</p>}

          {results.length > 0 && (
            <div className="mt-6 space-y-4">
              {results.map((candidate, index) => (
                <article key={candidate.website} className="rounded-xl border border-[#E5DDCE] bg-white p-5">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={candidate.selected}
                      onChange={(event) => updateCandidate(index, { selected: event.target.checked })}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[#14193A]">{candidate.title}</h3>
                          <a href={candidate.website} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-[#1B2A5E] underline">
                            {candidate.display_link || candidate.website}
                          </a>
                        </div>
                        <span className="rounded-full bg-[#F2EFE8] px-3 py-1 text-xs text-[#536079]">Google Treffer</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#6B7280]">{candidate.snippet}</p>
                      {candidate.selected && (
                        <div className="mt-5 grid gap-3 border-t border-[#EEE8DC] pt-5 sm:grid-cols-2">
                          <input className={fieldClass} value={candidate.company_name} onChange={(event) => updateCandidate(index, { company_name: event.target.value })} placeholder="Unternehmen / Marke" />
                          <input className={fieldClass} value={candidate.city} onChange={(event) => updateCandidate(index, { city: event.target.value })} placeholder="Ort" />
                          <input className={fieldClass} value={candidate.first_name} onChange={(event) => updateCandidate(index, { first_name: event.target.value })} placeholder="Vorname Ansprechpartner *" />
                          <input className={fieldClass} value={candidate.last_name} onChange={(event) => updateCandidate(index, { last_name: event.target.value })} placeholder="Nachname Ansprechpartner *" />
                          <input className={`${fieldClass} sm:col-span-2`} type="email" value={candidate.email} onChange={(event) => updateCandidate(index, { email: event.target.value })} placeholder="Geprüfte geschäftliche E-Mail *" />
                          <label className="flex gap-3 text-sm text-[#536079] sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={candidate.contact_verified}
                              onChange={(event) => updateCandidate(index, { contact_verified: event.target.checked })}
                            />
                            <span>Ich habe Ansprechpartner und geschäftliche E-Mail auf der öffentlichen Website geprüft.</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              <div className="flex justify-end">
                <button onClick={importSelected} disabled={importing} className="rounded-lg bg-[#1B2A5E] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {importing ? "Wird übernommen..." : "Ausgewählte Leads im CRM anlegen"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
