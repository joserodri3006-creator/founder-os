"use client";

import { useState, useRef } from "react";
import { useVenture } from "@/context/VentureContext";

const CSV_FIELDS = ["vorname", "nachname", "email", "firma", "telefon", "quelle", "branche", "stadt"] as const;
const FIELD_LABELS: Record<string, string> = {
  vorname: "Vorname", nachname: "Nachname", email: "E-Mail",
  firma: "Firma", telefon: "Telefon", quelle: "Quelle",
  branche: "Branche", stadt: "Stadt",
};
const LEAD_FIELDS = ["—", ...CSV_FIELDS];

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""))
  );
  return { headers, rows };
}

export default function CsvImportModal({ onClose, onImported }: Props) {
  const { venture } = useVenture();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h);
      setRows(r);
      // Auto-Mapping: Spaltenname direkt auf Feld matchen
      const autoMap: Record<string, string> = {};
      h.forEach((col) => {
        const normalized = col.toLowerCase();
        const match = CSV_FIELDS.find(
          (f) => f === normalized ||
          (f === "vorname" && (normalized.includes("vorname") || normalized === "first_name")) ||
          (f === "nachname" && (normalized.includes("nachname") || normalized === "last_name")) ||
          (f === "email" && normalized.includes("mail")) ||
          (f === "firma" && (normalized.includes("firma") || normalized.includes("company"))) ||
          (f === "telefon" && (normalized.includes("tel") || normalized.includes("phone"))) ||
          (f === "branche" && normalized.includes("branch")) ||
          (f === "stadt" && (normalized.includes("city") || normalized.includes("stadt")))
        );
        autoMap[col] = match ?? "—";
      });
      setMapping(autoMap);
      setResult(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  function getValue(row: string[], col: string): string {
    const idx = headers.indexOf(col);
    return idx >= 0 ? row[idx] ?? "" : "";
  }

  function buildPayload(row: string[]) {
    const get = (field: string) => {
      const col = Object.keys(mapping).find((c) => mapping[c] === field);
      return col ? getValue(row, col).trim() : "";
    };
    return {
      first_name: get("vorname"),
      last_name: get("nachname"),
      email: get("email"),
      company_name: get("firma") || undefined,
      phone: get("telefon") || undefined,
      source: get("quelle") || "csv_import",
      industry: get("branche") || undefined,
      city: get("stadt") || undefined,
      venture,
    };
  }

  async function handleImport() {
    // Prüfen ob Pflichtfelder gemappt sind
    const mappedFields = Object.values(mapping);
    const missing = ["vorname", "nachname", "email"].filter((f) => !mappedFields.includes(f));
    if (missing.length > 0) {
      setError(`Pflichtfelder nicht gemappt: ${missing.map((f) => ({ vorname: "Vorname", nachname: "Nachname", email: "E-Mail" }[f])).join(", ")}`);
      return;
    }

    const validRows = rows.filter((r) => {
      const p = buildPayload(r);
      return p.first_name && p.last_name && p.email;
    });

    if (validRows.length === 0) {
      setError("Keine gültigen Zeilen gefunden. Vorname, Nachname und E-Mail müssen in jeder Zeile vorhanden sein.");
      return;
    }

    setProgress({ done: 0, total: validRows.length });
    const res: ImportResult = { imported: 0, duplicates: 0, errors: 0 };

    for (let i = 0; i < validRows.length; i++) {
      try {
        const response = await fetch(
          "/api/leads",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildPayload(validRows[i])),
          }
        );
        const data = await response.json();
        if (data?.success && data?.duplicate) res.duplicates++;
        else if (data?.success) res.imported++;
        else res.errors++;
      } catch {
        res.errors++;
      }
      setProgress({ done: i + 1, total: validRows.length });
    }

    setResult(res);
    if (res.imported > 0) onImported();
  }

  const hasMappedRequired = rows.length > 0;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">CSV Import</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Upload */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">CSV-Datei auswählen</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">Erwartet: vorname, nachname, email, firma, telefon, quelle, branche, stadt</p>
          </div>

          {headers.length > 0 && (
            <>
              {/* Spalten-Mapping */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">Spalten-Mapping</h3>
                <div className="grid grid-cols-2 gap-2">
                  {headers.map((col) => (
                    <div key={col} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-28 truncate">{col}</span>
                      <span className="text-gray-300">→</span>
                      <select
                        value={mapping[col] ?? "—"}
                        onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        {LEAD_FIELDS.map((f) => (
                          <option key={f} value={f}>{f === "—" ? "— ignorieren" : FIELD_LABELS[f]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vorschau */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">Vorschau (erste 5 Zeilen)</h3>
                <div className="overflow-x-auto rounded border border-gray-100">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {headers.map((_, j) => (
                            <td key={j} className="px-3 py-2 text-gray-600">{row[j] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-1">{rows.length} Zeilen gesamt</p>
              </div>
            </>
          )}

          {/* Fortschritt */}
          {progress && !result && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Importiere…</span>
                <span className="text-gray-500">{progress.done} von {progress.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Ergebnis */}
          {result && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p className="font-medium text-gray-700 mb-2">Import abgeschlossen</p>
              <p className="text-green-600">{result.imported} importiert</p>
              {result.duplicates > 0 && <p className="text-orange-500">{result.duplicates} Duplikate übersprungen</p>}
              {result.errors > 0 && <p className="text-red-500">{result.errors} Fehler</p>}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            {!result ? (
              <button
                onClick={handleImport}
                disabled={!hasMappedRequired || !!progress}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {progress ? `Importiere ${progress.done}/${progress.total}…` : `${rows.length} Zeilen importieren`}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                Fertig
              </button>
            )}
            {!progress && (
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
