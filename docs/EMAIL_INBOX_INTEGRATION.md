# E-Mail-Inbox-Integration in Founder OS — Plan

> Status: **Entwurf, wartet auf Freigabe.** Noch nicht implementiert.
> Nach Freigabe: Phase 1 → 2 → 3 nacheinander umsetzen, dabei dieses
> Dokument in "Umsetzungsstatus" je Phase abhaken.

**Goal:** Alle Venture-Postfächer (außer der privaten Jose-Gmail) werden
automatisch alle 7 Stunden eingelesen, gegen bestehende Leads/Kunden gematcht
und im Founder-OS-Dashboard sichtbar gemacht — als Aktivitäts-Zeitleiste am
Lead/Kunden-Datensatz plus eine eigene "Unmatched"-Übersicht.

**Architektur:** Neue Supabase-Tabelle `inbox_messages` als System-of-Record.
Ein Python-Sync-Skript liest IMAP (Kasserver) und Gmail-API-Postfächer,
schreibt neue Nachrichten hinein und matcht per E-Mail-Adresse gegen
`leads`/`customers` (gleiche `venture`). Ein Hermes-Cronjob triggert den Sync
alle 7 Stunden. Das Next.js-Dashboard bekommt eine neue API-Route
`/api/inbox` plus zwei UI-Bausteine: `InboxTimeline` (eingebettet auf
Lead-/Kunden-Detailseiten, analog `TasksPanel`) und eine neue Seite
`/inbox/unmatched`.

**Tech-Stack:** Python 3 (`imaplib`, `email`, google-api-python-client für
Gmail), Supabase REST/PostgREST, Next.js/TypeScript (bestehendes Dashboard),
Hermes Cronjob.

---

## Scope

**Postfächer (5, alle außer privat):**

| Venture | Account-ID | Adresse | Zugriff |
|---|---|---|---|
| Brandary | `brandary_info` | info@bybrandary.de | IMAP (Kasserver) |
| Brandary | `brandary_gmail` | brandary069@gmail.com | Gmail API (Token `/opt/data/google_brandary/google_token.json`) |
| Online First | `onlinefirst_info` | info@onlinefirst.eu | IMAP (Kasserver) |
| Blazed Outfitters | `blazed_info` | info@blazedoutfitters.com | IMAP (Kasserver) |
| Blazed Outfitters | `blazed_gmail` | blazedoutfitters@gmail.com | Gmail API (Token `/opt/data/google_blazed/google_token.json`) |

**Explizit ausgeschlossen:** `jose.rodri3006@gmail.com` (privat) — wird vom
Sync-Skript niemals angesprochen, taucht in keiner Account-Liste auf.

**Historie:** Initialer Lauf holt die letzten **3 Tage** rückwirkend pro
Postfach. Danach nur noch inkrementell (neue Mails seit letztem Checkpoint).

**Datentiefe:** Metadaten (Absender, Betreff, Datum) **plus vollständiger
Body-Text** (Plaintext-Teil der Mail; bei reinen HTML-Mails wird HTML zu Text
konvertiert). Anhänge werden in Phase 1 nicht gespeichert (nur Dateiname als
Metadatum, falls trivial verfügbar — kein Anhang-Download).

**Matching:** ausschließlich exakter Treffer auf `from_email` gegen
`leads.email` / `customers.email` derselben `venture`. Kein Fuzzy-Matching,
keine automatische Neuanlage von Leads bei fehlendem Treffer (Policy:
"never_without_approval" bleibt gültig — die einzige Aktion bei
Nicht-Treffer ist der `unmatched`-Status, sichtbar im Dashboard).

---

## Phase 1 — Datenmodell (Supabase-Migration)

**Datei:** `supabase/migrations/inbox_messages.sql`

```sql
-- ============================================================
-- E-Mail-Inbox-Integration: eingehende Venture-Mails als
-- System-of-Record, verknüpft mit leads/customers per E-Mail-Match.
-- Polymorphes Muster analog zu tasks/attachments, aber mit
-- lead_id/customer_id statt entity_type/entity_id, weil eine Mail
-- höchstens EINEN Treffer hat (nie beides gleichzeitig).
-- ============================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venture        venture     NOT NULL,
  account_email  TEXT        NOT NULL,          -- z.B. info@bybrandary.de
  folder         TEXT        NOT NULL DEFAULT 'INBOX',
  message_uid    TEXT        NOT NULL,           -- IMAP UID bzw. Gmail message id (als String)
  message_id     TEXT,                           -- RFC822 Message-ID Header, falls vorhanden
  from_email     TEXT        NOT NULL,
  from_name      TEXT,
  subject        TEXT,
  body_text      TEXT,
  received_at    TIMESTAMPTZ NOT NULL,
  lead_id        UUID        REFERENCES leads(id) ON DELETE SET NULL,
  customer_id    UUID        REFERENCES customers(id) ON DELETE SET NULL,
  match_status   TEXT        NOT NULL DEFAULT 'unmatched'
                 CHECK (match_status IN ('matched_lead', 'matched_customer', 'unmatched')),
  created_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE (account_email, folder, message_uid)
);

CREATE INDEX IF NOT EXISTS inbox_messages_venture_idx      ON inbox_messages(venture);
CREATE INDEX IF NOT EXISTS inbox_messages_lead_idx         ON inbox_messages(lead_id);
CREATE INDEX IF NOT EXISTS inbox_messages_customer_idx     ON inbox_messages(customer_id);
CREATE INDEX IF NOT EXISTS inbox_messages_match_status_idx ON inbox_messages(match_status);
CREATE INDEX IF NOT EXISTS inbox_messages_received_at_idx  ON inbox_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS inbox_messages_from_email_idx   ON inbox_messages(from_email);

-- App-Zugriff läuft wie bei tasks/attachments über die service-role
-- (proxy.ts prüft Section-Permissions serverseitig), kein RLS nötig.
ALTER TABLE inbox_messages DISABLE ROW LEVEL SECURITY;
```

**Verifikation:** Migration gegen Supabase anwenden (`supabase db push` oder
direkt per REST DDL, je nachdem was für dieses Projekt üblich ist — siehe
`CLAUDE.md`-DB-Verbindung), danach `GET /rest/v1/inbox_messages?limit=1`
gegen die Service-Role prüfen, dass die Tabelle leer aber erreichbar ist.

**Datei:** `.env`/Secrets — keine neuen Secrets nötig, bestehende Postfach-
Zugangsdaten aus `/opt/data/email/*_accounts.json` und
`/opt/data/secrets/*_email_password` bzw. Gmail-Tokens werden wiederverwendet.

---

## Phase 2 — Sync-Skript + Cronjob

**Datei:** `/opt/data/scripts/inbox_sync.py`

Verantwortlichkeiten:

1. Für jedes der 5 Postfächer (siehe Scope-Tabelle) verbinden:
   - IMAP-Konten (`brandary_info`, `onlinefirst_info`, `blazed_info`) via
     `imaplib.IMAP4_SSL(host, port)` + Login aus
     `/opt/data/email/<venture>_accounts.json` (Passwort aus
     `password_file` bzw. inline `password`-Feld).
   - Gmail-Konten (`brandary_gmail`, `blazed_gmail`) via
     `google-api-python-client` (Gmail API) mit dem jeweiligen
     `token_path` aus der Accounts-Datei — **niemals** den
     Standard-`google_token.json` (jose.rodri3006) verwenden.
2. Checkpoint pro Postfach: höchste bereits gespeicherte `message_uid`
   (Query gegen `inbox_messages?account_email=eq.X&order=received_at.desc&limit=1`).
   Erster Lauf: Checkpoint = "vor 3 Tagen" statt UID-basiert (IMAP `SINCE`-
   Suche / Gmail `after:`-Query).
3. Neue Nachrichten holen, parsen (Absender, Name, Betreff, Datum,
   Plaintext-Body — HTML-only Mails mit einfachem HTML-zu-Text-Fallback,
   z.B. `html.parser` strip oder `BeautifulSoup.get_text()`).
4. Matching: `from_email` (lowercase, getrimmt) gegen
   `leads?venture=eq.<v>&email=eq.<from_email>` und
   `customers?venture=eq.<v>&email=eq.<from_email>` prüfen (Leads zuerst,
   dann Kunden — ein Kunde, der vorher Lead war, hat i.d.R. `leads.customer_id`
   gesetzt, das reicht als Kontext, doppelte Verknüpfung wird nicht gebraucht).
5. INSERT in `inbox_messages` mit passendem `match_status`/`lead_id`/
   `customer_id`. Bei Konflikt (`UNIQUE (account_email, folder, message_uid)`)
   `Prefer: resolution=ignore-duplicates` verwenden — idempotent bei
   mehrfachem Lauf.
6. Bei einem Treffer zusätzlich einen `lead_activities`-Eintrag anlegen:
   `activity_type: 'email_received'`, `description: "E-Mail erhalten: <Betreff>"`
   — nur wenn `lead_id` gesetzt ist (lead_activities hat keine
   customer-Variante; für reine Kundentreffer reicht der Eintrag in
   `inbox_messages` selbst, das Dashboard liest ihn direkt aus dieser Tabelle).
7. Am Ende eine kompakte Zusammenfassung ausgeben (pro Postfach: Anzahl neu,
   Anzahl gematcht, Anzahl unmatched) — das ist der Text, den der Cronjob im
   Erfolgsfall meldet.

**Fehlerbehandlung:** ein Postfach-Fehler (Login/Timeout) darf die anderen
4 nicht blockieren — pro Postfach in try/except, Fehler in der
Zusammenfassung auflisten statt den ganzen Lauf abzubrechen.

**Cronjob:**

```
mcp__cronjob action=create
schedule="every 7h"
name="inbox-sync-founder-os"
script="/opt/data/scripts/inbox_sync.py"
no_agent=true          -- reines Skript, kein LLM nötig
deliver="local"         -- nur bei Fehlern/Auffälligkeiten relevant,
                            kein Chat-Spam bei normalem Lauf
```

Da `no_agent=true` nur bei **leerem** stdout still bleibt, gibt das Skript
bei komplett fehlerfreiem Lauf ohne neue Mails nichts aus (silent tick); bei
neuen Mails oder Fehlern eine kurze Zusammenfassungszeile.

**Verifikation:** Skript einmal manuell im Terminal laufen lassen
(`python3 /opt/data/scripts/inbox_sync.py`), Ergebnis gegen
`inbox_messages?limit=20&order=received_at.desc` prüfen, dann Cronjob
anlegen und einen Testlauf via `cronjob action=run` auslösen.

---

## Phase 3 — Dashboard-Integration

**Neue API-Route:** `dashboard/app/api/inbox/route.ts`
- `GET /api/inbox?entity_type=lead&entity_id=<uuid>` → Nachrichten für einen
  Lead (via `lead_id`).
- `GET /api/inbox?entity_type=customer&entity_id=<uuid>` → Nachrichten für
  einen Kunden (via `customer_id`).
- `GET /api/inbox?match_status=unmatched&venture=<v>` → Liste für die neue
  Unmatched-Übersicht, serverseitig paginiert (analog `/api/tasks`-Pattern).

**Neue UI-Komponente:** `dashboard/components/InboxTimeline.tsx`
- Analog zu `TasksPanel.tsx` (siehe
  `founder-os-dashboard-ui-fixes-via-claude-code.md`-Referenz für das
  Muster) — eingebettet in `app/leads/[id]/page.tsx` und
  `app/kunden/[id]/page.tsx`, zeigt Betreff, Datum, Absender, aufklappbarer
  Body-Text, chronologisch absteigend.

**Neue Seite:** `dashboard/app/inbox/unmatched/page.tsx`
- Einfache Liste aller `match_status=unmatched`-Nachrichten, filterbar nach
  Venture, mit Absender/Betreff/Datum — Zweck: manuell erkennen, ob ein
  Lead fehlt. Keine Inline-Aktionen in Phase 3 (kein "Als Lead anlegen"-
  Button) — das wäre ein Folge-Feature, falls gewünscht.

**Umsetzung:** wie bei Dashboard-Bugfixes über Claude Code CLI im Repo
(`/opt/data/projects/founder-os/dashboard`), Push direkt auf `main`
(Vercel-Auto-Deploy), `npm run build` muss vor Commit sauber durchlaufen.

**Verifikation:** nach Deploy einen Lead/Kunden mit mindestens einer
gematchten Test-Mail öffnen und die Zeitleiste sichten; `/inbox/unmatched`
öffnen und prüfen, dass unmatched Test-Mails erscheinen.

---

## Reihenfolge & Freigabe

1. Phase 1 (Migration) → Rückmeldung mit Tabellen-Check.
2. Phase 2 (Sync-Skript + Cron) → Rückmeldung mit erstem Sync-Ergebnis
   (Anzahl importierter Mails je Postfach, Anzahl Treffer/unmatched).
3. Phase 3 (Dashboard) → Rückmeldung mit Vercel-Deploy-Bestätigung und
   Screenshot/Beschreibung der neuen Ansicht.

Jede Phase wird erst gestartet, nachdem die vorherige bestätigt lief — bei
Problemen (z.B. IMAP-Login schlägt fehl, Gmail-Token abgelaufen) wird vor
Phase 3 gestoppt und Rücksprache gehalten.

## Offene Punkte / bewusst nicht in diesem Scope

- Kein automatisches Anlegen neuer Leads aus unmatched-Mails (nur sichtbar,
  manuelle Entscheidung bleibt beim Nutzer).
- Keine Anhang-Speicherung in Phase 1 (nur Body-Text).
- Kein Reply/Send aus dem Dashboard heraus (das deckt bereits
  `SendMailModal`/`outreach_templates` ab, hier geht es nur um Empfang).
- `worknest`- und `droplane`-Postfächer sind nicht im Scope (aktuell keine
  bekannten Postfächer für diese Ventures in
  `/opt/data/email/*_accounts.json`).
