"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useVenture } from "@/context/VentureContext";
import { useAuth } from "@/context/AuthContext";

interface Share {
  id?: string;
  occurrence_id?: string | null;
  partner_name: string;
  partner_user_id?: string | null;
  share_amount: number;
  paid_amount: number;
  paid_date?: string | null;
  notes?: string | null;
}

interface Occurrence {
  id: string;
  occurrence_date: string;
  amount: number;
  status: "offen" | "bezahlt" | "storniert";
  paid_date: string | null;
}

interface Entry {
  id: string;
  venture: string;
  type: "einnahme" | "ausgabe";
  description: string;
  category: string | null;
  account: string | null;
  amount: number;
  currency: string;
  status: "offen" | "bezahlt" | "storniert";
  entry_date: string;
  paid_date: string | null;
  is_recurring: boolean;
  recurrence_interval: "monatlich" | "quartalsweise" | "jaehrlich" | null;
  recurrence_end_date: string | null;
  order_id: string | null;
  notes: string | null;
  finance_entry_occurrences: Occurrence[];
  finance_entry_shares: Share[];
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function money(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// ── Neue-Buchung-Formular ───────────────────────────────────────────────────
function EntryForm({ venture, onSaved, onCancel, editEntry }: {
  venture: string;
  onSaved: () => void;
  onCancel: () => void;
  editEntry?: Entry | null;
}) {
  const [type, setType] = useState<"einnahme" | "ausgabe">(editEntry?.type ?? "ausgabe");
  const [description, setDescription] = useState(editEntry?.description ?? "");
  const [category, setCategory] = useState(editEntry?.category ?? "");
  const [account, setAccount] = useState(editEntry?.account ?? "");
  const [amount, setAmount] = useState(editEntry ? String(editEntry.amount) : "");
  const [status, setStatus] = useState<"offen" | "bezahlt" | "storniert">(editEntry?.status ?? "offen");
  const [entryDate, setEntryDate] = useState(editEntry?.entry_date ?? new Date().toISOString().slice(0, 10));
  const [paidDate, setPaidDate] = useState(editEntry?.paid_date ?? "");
  const [isRecurring, setIsRecurring] = useState(editEntry?.is_recurring ?? false);
  const [interval, setInterval_] = useState<"monatlich" | "quartalsweise" | "jaehrlich">(editEntry?.recurrence_interval ?? "monatlich");
  const [recurrenceEnd, setRecurrenceEnd] = useState(editEntry?.recurrence_end_date ?? "");
  const [notes, setNotes] = useState(editEntry?.notes ?? "");
  const [shares, setShares] = useState<Share[]>(editEntry?.finance_entry_shares?.map(s => ({ ...s })) ?? []);
  const [saving, setSaving] = useState(false);

  function addShare() {
    setShares(s => [...s, { partner_name: "", share_amount: 0, paid_amount: 0 }]);
  }
  function updateShare(idx: number, patch: Partial<Share>) {
    setShares(s => s.map((sh, i) => (i === idx ? { ...sh, ...patch } : sh)));
  }
  function removeShare(idx: number) {
    setShares(s => s.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!description.trim() || !amount || Number(amount) <= 0) return;
    setSaving(true);
    const payload = {
      venture, type, description: description.trim(),
      category: category.trim() || null, account: account.trim() || null,
      amount: Number(amount), status, entry_date: entryDate,
      paid_date: status === "bezahlt" ? (paidDate || entryDate) : null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? interval : null,
      recurrence_end_date: isRecurring ? (recurrenceEnd || null) : null,
      notes: notes.trim() || null,
      shares: shares.filter(s => s.partner_name.trim()),
    };
    const url = editEntry ? `/api/finanzen/${editEntry.id}` : "/api/finanzen";
    const method = editEntry ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) onSaved();
    else { const err = await res.json(); alert(err.error ?? "Fehler beim Speichern"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-[#14193A]">{editEntry ? "Buchung bearbeiten" : "Neue Buchung"}</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden col-span-2">
            <button onClick={() => setType("einnahme")}
              className={`flex-1 text-sm py-2 font-medium ${type === "einnahme" ? "bg-emerald-50 text-emerald-700" : "text-gray-500"}`}>
              Einnahme
            </button>
            <button onClick={() => setType("ausgabe")}
              className={`flex-1 text-sm py-2 font-medium ${type === "ausgabe" ? "bg-red-50 text-red-700" : "text-gray-500"}`}>
              Ausgabe
            </button>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Kurzbeschreibung *</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie (optional)</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. Software, Marketing"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konto (optional)</label>
            <input value={account} onChange={e => setAccount(e.target.value)} placeholder="z.B. Geschäftskonto"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Betrag (EUR) *</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40">
              <option value="offen">Offen</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="storniert">Storniert</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{isRecurring ? "Startdatum *" : "Datum *"}</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
          </div>
          {status === "bezahlt" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zahlungsdatum</label>
              <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
            </div>
          )}

          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
            <label htmlFor="recurring" className="text-sm text-gray-700">Wiederkehrende Buchung</label>
          </div>

          {isRecurring && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Intervall</label>
                <select value={interval} onChange={e => setInterval_(e.target.value as any)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40">
                  <option value="monatlich">Monatlich</option>
                  <option value="quartalsweise">Quartalsweise</option>
                  <option value="jaehrlich">Jährlich</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ende (optional)</label>
                <input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40" />
              </div>
            </>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 resize-none" />
          </div>
        </div>

        {/* Partner-Zahlungsanteile */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Wer hat eingezahlt/bezahlt</p>
            <button onClick={addShare} className="text-xs text-[#1B2A5E] font-medium hover:underline">+ Partner hinzufügen</button>
          </div>
          {shares.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Aufteilung — ganze Buchung ohne Partner-Zuordnung.</p>
          ) : (
            <div className="space-y-2">
              {shares.map((s, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <input placeholder="Name" value={s.partner_name} onChange={e => updateShare(idx, { partner_name: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
                  <input type="number" step="0.01" placeholder="Anteil €" value={s.share_amount || ""}
                    onChange={e => updateShare(idx, { share_amount: Number(e.target.value) })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-24" />
                  <input type="number" step="0.01" placeholder="Bezahlt €" value={s.paid_amount || ""}
                    onChange={e => updateShare(idx, { paid_amount: Number(e.target.value) })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-24" />
                  <button onClick={() => removeShare(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50">
            Abbrechen
          </button>
          <button onClick={save} disabled={!description.trim() || !amount || saving}
            className="flex-1 text-sm bg-[#1B2A5E] text-white rounded-lg py-2 hover:bg-[#14193A] disabled:opacity-40 font-medium">
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hauptseite ───────────────────────────────────────────────────────────────
export default function FinanzenPage() {
  const { venture } = useVenture();
  const { canEdit } = useAuth();
  const editable = canEdit("finances");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"monat" | "jahr">("monat");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = view === "monat"
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`;
    const to = view === "monat"
      ? new Date(year, month, 0).toISOString().slice(0, 10) // letzter Tag des Monats
      : `${year}-12-31`;
    const res = await fetch(`/api/finanzen?venture=${venture}&from=${from}&to=${to}`);
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [venture, view, year, month]);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(id: string, description: string) {
    if (!confirm(`"${description}" vollständig löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    await fetch(`/api/finanzen/${id}`, { method: "DELETE" });
    await load();
  }

  async function markOccurrence(occId: string, status: "offen" | "bezahlt" | "storniert") {
    await fetch(`/api/finanzen/vorkommen/${occId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  // Flache Liste aller sichtbaren (Buchung, Vorkommen)-Paare im Zeitraum.
  const rows = useMemo(() => {
    const list: { entry: Entry; occ: Occurrence }[] = [];
    for (const e of entries) {
      for (const o of e.finance_entry_occurrences ?? []) {
        list.push({ entry: e, occ: o });
      }
    }
    return list.sort((a, b) => b.occ.occurrence_date.localeCompare(a.occ.occurrence_date));
  }, [entries]);

  // Summen: nur status "bezahlt" zählt in "Ist", alle (außer storniert) in "Soll".
  const summary = useMemo(() => {
    let einnahmenIst = 0, ausgabenIst = 0, einnahmenSoll = 0, ausgabenSoll = 0;
    for (const { entry, occ } of rows) {
      if (occ.status === "storniert") continue;
      const amt = Number(occ.amount);
      if (entry.type === "einnahme") {
        einnahmenSoll += amt;
        if (occ.status === "bezahlt") einnahmenIst += amt;
      } else {
        ausgabenSoll += amt;
        if (occ.status === "bezahlt") ausgabenIst += amt;
      }
    }
    return {
      einnahmenIst, ausgabenIst, saldoIst: einnahmenIst - ausgabenIst,
      einnahmenSoll, ausgabenSoll, saldoSoll: einnahmenSoll - ausgabenSoll,
    };
  }, [rows]);

  // Monatssummen für die Jahresansicht.
  const monthlyBreakdown = useMemo(() => {
    if (view !== "jahr") return [];
    const buckets: Record<number, { einnahmen: number; ausgaben: number }> = {};
    for (let m = 1; m <= 12; m++) buckets[m] = { einnahmen: 0, ausgaben: 0 };
    for (const { entry, occ } of rows) {
      if (occ.status !== "bezahlt") continue;
      const m = Number(occ.occurrence_date.slice(5, 7));
      if (entry.type === "einnahme") buckets[m].einnahmen += Number(occ.amount);
      else buckets[m].ausgaben += Number(occ.amount);
    }
    return buckets;
  }, [rows, view]);

  return (
    <>
      {showForm && (
        <EntryForm
          venture={venture}
          editEntry={editEntry}
          onCancel={() => { setShowForm(false); setEditEntry(null); }}
          onSaved={async () => { setShowForm(false); setEditEntry(null); await load(); }}
        />
      )}

      <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#14193A]">Finanzen</h1>
            <p className="text-sm text-gray-500 mt-1">Einnahmen & Ausgaben · einmalig und wiederkehrend</p>
          </div>
          {editable && (
            <button onClick={() => { setEditEntry(null); setShowForm(true); }}
              className="text-sm px-4 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14193A] font-medium">
              + Neue Buchung
            </button>
          )}
        </div>

        {/* Sichten-Umschalter + Zeitraum */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView("monat")}
              className={`text-sm px-4 py-2 font-medium ${view === "monat" ? "bg-[#1B2A5E] text-white" : "bg-white text-gray-600"}`}>
              Monatsansicht
            </button>
            <button onClick={() => setView("jahr")}
              className={`text-sm px-4 py-2 font-medium ${view === "jahr" ? "bg-[#1B2A5E] text-white" : "bg-white text-gray-600"}`}>
              Jahresansicht
            </button>
          </div>

          {view === "monat" && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
              {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Summenkarten */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Einnahmen (bezahlt)</p>
            <p className="text-lg font-semibold text-emerald-600">{money(summary.einnahmenIst)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Soll: {money(summary.einnahmenSoll)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Ausgaben (bezahlt)</p>
            <p className="text-lg font-semibold text-red-600">{money(summary.ausgabenIst)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Soll: {money(summary.ausgabenSoll)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 mb-1">Saldo (bezahlt)</p>
            <p className={`text-lg font-semibold ${summary.saldoIst >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(summary.saldoIst)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Soll: {money(summary.saldoSoll)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Buchungen</p>
            <p className="text-lg font-semibold text-[#14193A]">{rows.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">im Zeitraum</p>
          </div>
        </div>

        {/* Jahresansicht: Monatsbreakdown */}
        {view === "jahr" && (
          <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monatsübersicht {year}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {MONTH_NAMES.map((name, i) => {
                const m = i + 1;
                const b = monthlyBreakdown[m] ?? { einnahmen: 0, ausgaben: 0 };
                const saldo = b.einnahmen - b.ausgaben;
                return (
                  <button key={m} onClick={() => { setView("monat"); setMonth(m); }}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-sm hover:bg-gray-50 text-left">
                    <span className="text-gray-700">{name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-600">{money(b.einnahmen)}</span>
                      <span className="text-red-600">{money(b.ausgaben)}</span>
                      <span className={`font-semibold w-24 text-right ${saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(saldo)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Buchungsliste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Laden…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-3">💶</div>
              <p className="text-sm text-gray-500">Keine Buchungen in diesem Zeitraum</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map(({ entry, occ }) => (
                <div key={occ.id} className="px-5 py-3 flex items-center gap-3 group">
                  <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${entry.type === "einnahme" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {entry.type === "einnahme" ? "EIN" : "AUS"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#14193A] truncate">{entry.description}</span>
                      {entry.is_recurring && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
                          ↻ {entry.recurrence_interval}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span>{occ.occurrence_date}</span>
                      {entry.category && <span>· {entry.category}</span>}
                      {entry.account && <span>· {entry.account}</span>}
                      {entry.finance_entry_shares?.length > 0 && (
                        <span>· {entry.finance_entry_shares.map(s => s.partner_name).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${entry.type === "einnahme" ? "text-emerald-600" : "text-red-600"}`}>
                    {money(Number(occ.amount))}
                  </span>
                  {editable ? (
                    <select value={occ.status} onChange={e => markOccurrence(occ.id, e.target.value as any)}
                      className={`text-xs border rounded-lg px-2 py-1 shrink-0 ${
                        occ.status === "bezahlt" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                        occ.status === "storniert" ? "border-gray-200 bg-gray-50 text-gray-400" :
                        "border-amber-200 bg-amber-50 text-amber-700"
                      }`}>
                      <option value="offen">Offen</option>
                      <option value="bezahlt">Bezahlt</option>
                      <option value="storniert">Storniert</option>
                    </select>
                  ) : (
                    <span className={`text-xs shrink-0 px-2 py-1 rounded-lg ${
                      occ.status === "bezahlt" ? "bg-emerald-50 text-emerald-700" :
                      occ.status === "storniert" ? "bg-gray-50 text-gray-400" : "bg-amber-50 text-amber-700"
                    }`}>
                      {occ.status === "bezahlt" ? "Bezahlt" : occ.status === "storniert" ? "Storniert" : "Offen"}
                    </span>
                  )}
                  {editable && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => { setEditEntry(entry); setShowForm(true); }}
                        className="text-xs text-gray-400 hover:text-[#1B2A5E] px-2 py-1 rounded hover:bg-gray-100">
                        Bearbeiten
                      </button>
                      <button onClick={() => deleteEntry(entry.id, entry.description)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Hinweise</p>
          <ul className="space-y-0.5 text-blue-600 list-disc list-inside">
            <li>„Ist" zählt nur bezahlte Buchungen, „Soll" alle offenen + bezahlten (ohne Stornos)</li>
            <li>Wiederkehrende Buchungen erzeugen automatisch ein Vorkommen pro Intervall — jedes einzeln als bezahlt markierbar</li>
            <li>Partneranteile zeigen, wer von mehreren Partnern wie viel eingezahlt/bezahlt hat</li>
            <li>Nur Venture-Manager und Founder sehen und bearbeiten diese Seite</li>
          </ul>
        </div>
      </div>
    </>
  );
}
