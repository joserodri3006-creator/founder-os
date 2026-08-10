"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useVenture } from "@/context/VentureContext";
import { VENTURES } from "@/lib/ventures";

interface ReportResult {
  sql: string;
  explanation: string;
  row_count: number;
  rows: Record<string, unknown>[];
}

const EXAMPLE_QUESTIONS = [
  "Wie viele Leads haben wir diese Woche pro Venture bekommen?",
  "Welche Aufträge sind seit mehr als 14 Tagen im Status 'in_bearbeitung'?",
  "Was ist der durchschnittliche Auftragswert pro Venture in den letzten 90 Tagen?",
  "Welche Kunden haben noch keine Bestellung abgeschlossen?",
];

export default function ReportingPage() {
  const { user, loading: authLoading } = useAuth();
  const { venture } = useVenture();
  const [question, setQuestion] = useState("");
  const [scopeToVenture, setScopeToVenture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  async function runQuery(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/reporting/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, venture: scopeToVenture ? venture : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler");
        if (data.sql) setResult({ sql: data.sql, explanation: data.explanation ?? "", row_count: 0, rows: [] });
        return;
      }
      setResult(data);
      setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 8));
    } catch {
      setError("Anfrage fehlgeschlagen — bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  if (user && user.role !== "founder") {
    return (
      <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-6 text-sm text-gray-600">
          Reporting/Selektion steht nur dem Founder zur Verfügung, da Abfragen
          ventureübergreifend auf alle Geschäftsdaten zugreifen können.
        </div>
      </div>
    );
  }

  const columns = result && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
  const ventureLabel = VENTURES.find(v => v.id === venture)?.label ?? venture;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Reporting · Selektion</h1>
        <p className="text-sm text-gray-500 mt-1">
          Stelle eine Frage in normaler Sprache — Claude generiert eine Read-Only-SQL-Abfrage
          über alle Ventures und führt sie sicher aus.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-6">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runQuery(question);
          }}
          placeholder="z.B. Wie viele Leads sind diesen Monat bei Online First gewonnen worden?"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={scopeToVenture} onChange={e => setScopeToVenture(e.target.checked)} />
            Nur auf {ventureLabel} eingrenzen (sonst alle Ventures)
          </label>
          <button
            onClick={() => runQuery(question)}
            disabled={loading || !question.trim()}
            className="text-sm px-4 py-2 rounded-md text-white font-medium disabled:opacity-40"
            style={{ background: "#1B2A5E" }}
          >
            {loading ? "Fragt Claude…" : "Abfragen"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {EXAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => { setQuestion(q); runQuery(q); }}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700">{result.explanation}</p>
            <button
              onClick={() => setShowSql(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-2"
            >
              {showSql ? "SQL ausblenden" : "Generierte SQL anzeigen"}
            </button>
            {showSql && (
              <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {result.sql}
              </pre>
            )}
          </div>

          {result.rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Keine Ergebnisse</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {columns.map(col => (
                      <th key={col} className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => (
                        <td key={col} className="px-5 py-2.5 text-gray-700 whitespace-nowrap">
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {result.row_count} Zeile{result.row_count === 1 ? "" : "n"}
            {result.row_count === 500 && " (auf 500 begrenzt)"}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Letzte Fragen</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map(h => (
              <button
                key={h}
                onClick={() => { setQuestion(h); runQuery(h); }}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
