// Generiert die Liste der Vorkommen-Daten (YYYY-MM-DD) einer Finanzbuchung.
// Nicht-wiederkehrende Buchungen haben genau ein Vorkommen: ihr eigenes Datum.
// Wiederkehrende Buchungen werden bis einschließlich des aktuellen Monats
// (oder bis recurrence_end_date, falls früher) vorgeneriert, damit Monats-/
// Jahressummen sofort korrekt sind, ohne bei jeder Abfrage neu zu rechnen.
// Künftige Monate werden einmal pro Monat durch /api/finanzen/vorkommen-generieren
// (Cron) nachgezogen.

interface EntryLike {
  entry_date: string;
  is_recurring: boolean;
  recurrence_interval: "monatlich" | "quartalsweise" | "jaehrlich" | null;
  recurrence_end_date: string | null;
}

function addInterval(date: Date, interval: string): Date {
  const next = new Date(date);
  if (interval === "monatlich") next.setMonth(next.getMonth() + 1);
  else if (interval === "quartalsweise") next.setMonth(next.getMonth() + 3);
  else if (interval === "jaehrlich") next.setFullYear(next.getFullYear() + 1);
  return next;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function generateOccurrences(entry: EntryLike, upTo?: Date): string[] {
  const start = new Date(entry.entry_date + "T00:00:00Z");
  if (!entry.is_recurring || !entry.recurrence_interval) {
    return [entry.entry_date];
  }

  const horizon = upTo ?? new Date();
  // Ein Monat Vorlauf, damit bereits geplante künftige Fälligkeiten sichtbar sind.
  horizon.setMonth(horizon.getMonth() + 1);

  const end = entry.recurrence_end_date ? new Date(entry.recurrence_end_date + "T00:00:00Z") : null;

  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= horizon && (!end || cursor <= end) && guard < 600) {
    dates.push(toISODate(cursor));
    cursor = addInterval(cursor, entry.recurrence_interval);
    guard += 1;
  }
  return dates;
}
