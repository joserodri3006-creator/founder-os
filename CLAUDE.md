# Founder OS — CLAUDE.md

> Dieses Dokument ist die Single Source of Truth für das Founder OS Projekt.
> Bei jedem Session-Start hier beginnen: aktuellen Status lesen, dann handeln.

---

## Was ist Founder OS?

Ein KI-gestütztes Betriebssystem für einen Multi-Venture Founder.
Ziel: Alle 5 Ventures laufen durch eine zentrale Infrastruktur — automatisiert,
skalierbar, founder-geführt via Telegram.

---

## Die 5 Ventures

| Venture | Kategorie | Phase | Status |
|---|---|---|---|
| Online First | Webdesign | Phase 1 — Cashflow | Aktiv, Fokus-Venture |
| Blazed Outfitters | Fashion | Phase 2 — Growth | Aufbau |
| Droplane | Creator-Plattform | Phase 2 — Growth | Aufbau |
| Brandary | Print Studio | Phase 3 — Engine | Skalierung |
| Worknest | B2B SaaS | Phase 3 — Engine | Skalierung |

**Strategie:** Phase 1 finanziert Phase 2, Phase 2 finanziert Phase 3.
Online First generiert jetzt Cashflow — alles andere wird parallel aufgebaut.

---

## Tech-Stack

| Schicht | Tool | Zweck |
|---|---|---|
| Datenbank | Supabase + pgvector | Single Source of Truth, alle Ventures |
| Orchestrator | Supabase Edge Functions | Automationen, Workflows, Webhooks |
| KI | Claude API | Sonnet (komplex), Haiku (Routinen) |
| Founder-Interface | Next.js Dashboard (Vercel) | Live unter Vercel-URL |
| E-Commerce | WooCommerce REST API | Blazed Outfitters, Brandary Shop |
| E-Mail | Resend.com | Transaktional + Campaigns (Domain onlinefirst.eu verifiziert) |
| Social Media | Buffer API | Content-Scheduling |
| Dokumente | Google Drive | Reports, Vorlagen, Ablage |

**KI-Modell-Regel:**
- `claude-sonnet-4-6` — Lead-Analyse, Content-Generierung, komplexe Entscheidungen
- `claude-haiku-4-5-20251001` — Klassifizierung, Tagging, Routing, Polling

---

## Repositories & Deployment

| | |
|---|---|
| **GitHub** | github.com/joserodri3006-creator/founder-os (privat) |
| **Vercel** | Root Directory: `dashboard` — deployt bei jedem `git push main` |
| **Supabase** | Projekt-ID: `bshuqljbanmphmjyicdc` |

**Deployment-Workflow:** Änderungen lokal → `git add` → `git commit` → `git push` → Vercel deployt automatisch.

---

## Supabase DB — Aktuelles Schema (Stand 2026-04-03)

**Tabellen:**
- `leads` — Lead-Pipeline (alle Ventures)
- `customers` — Kundenstamm (alle Ventures)
- `lead_activities` — Aktivitäten pro Lead
- `mail_templates` — E-Mail-Vorlagen
- `orders` — Aufträge (alle Ventures)
- `order_activities` — Aktivitäten/Audit Trail pro Auftrag
- `payment_models` — Zahlungsmodelle pro Venture (flexibel, JSON-Steps)
- `system_config` — Zentrale Konfiguration (KI-Suche, Venture-Infos, etc.)

**orders-Spalten:**
`invoice_number`, `invoice_generated_at`, `invoice_html`, `invoice_data` (JSONB),
`payment_model_id`, `payment_steps` (JSONB), `invoice_sent`, `anzahlung_erhalten`, `restzahlung_erhalten`

**Views:** `v_lead_pipeline`, `v_due_follow_ups`, `v_daily_new_leads`, `v_reactivation_today`

**Enums:** `venture` (online_first, blazed_outfitters, droplane, brandary — worknest noch nicht), `lead_status`, `lead_source`, `order_status`

**Noch offen:** pgvector Embedding-Spalte in `leads` (für Phase 2 KI-Features)

### DB-Verbindung (für Claude Code)

```
Host:     aws-1-eu-west-1.pooler.supabase.com
Port:     6543
DB:       postgres
User:     postgres.bshuqljbanmphmjyicdc
Password: [in .env.local / Vercel env vars]
```

MCP-Config: `~/.claude/settings.json` → `@modelcontextprotocol/server-postgres`
Direktverbindung Node.js: password = `Jlraxx3006?!`

---

## Edge Functions (alle deployed)

| Function | Trigger | Zweck |
|---|---|---|
| `lead-intake` | HTTP POST | Lead-Eingang aus Webformular |
| `lead-qualify` | HTTP POST | KI-Qualifizierung (Haiku + Sonnet), per-venture Kontext |
| `status-workflow` | DB Webhook (leads UPDATE) | KI-Draft generieren bei Status-Änderung |
| `order-workflow` | DB Webhook (orders INSERT/UPDATE) | Mails + Aktivitäten + Payment-Model auto-assign |
| `ki-lead-search` | pg_cron 08:00 UTC | Täglich neue Leads via Claude suchen (4 Ventures) |
| `daily-summary` | pg_cron 18:00 UTC | Tages-Zusammenfassung per Mail an Founder |

---

## Dashboard (Next.js) — Feature-Stand

### Seiten
- `/dashboard` — KPI-Kacheln pro Venture, neueste Leads
- `/leads` — Pipeline, Status inline, Neuer Lead Modal, CSV Import, Duplikat-Markierung
- `/leads/[id]` — Lead-Detail mit Aktivitäten
- `/drafts` — KI-Drafts reviewen, editieren, senden (per Venture gefiltert)
- `/kunden` — Kundenliste (per Venture gefiltert)
- `/auftraege` — Auftragsliste mit Status + Wert
- `/auftraege/[id]` — Auftragsdetail: Status-Timeline, Zahlungsschritte, Rechnung, Aktivitäten
- `/einstellungen` — KI-Suche, Venture-Infos (Firmendaten für Rechnungen), allg. Config
- `/einstellungen/zahlungsmodelle` — Zahlungsmodelle pro Venture verwalten

### Globale Features
- **Venture Switcher** in Sidebar — persistiert in localStorage, alle Seiten reagieren
- **Resend E-Mail** — Domain onlinefirst.eu verifiziert, echte Absender aktiv
- **Rechnungsgenerierung** — HTML-Rechnung, editierbar (Positionen, Empfänger, MwSt.), Download + E-Mail-Versand
- **Zahlungsmodelle** — flexibel per Venture, Steps mit Trigger + Fälligkeit, Toggle pro Schritt
- **system_config upsert** — neue Keys werden automatisch angelegt

### Env Vars (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

---

## Offene Punkte (Phase 1)

- [ ] pgvector Extension aktivieren (Supabase Dashboard → Extensions → vector)
- [ ] `worknest` zum `venture` Enum hinzufügen (aktuell nicht in DB)
- [ ] Vercel-URL in dieses Dokument eintragen sobald bekannt

## Nächste Phase (Phase 2 / Phase 3)

- [ ] Schritt 3 — Operations Agent MVP (Brandary): Druckaufträge, Material, Rechnungs-Generierung → Google Drive
- [ ] Telegram-Interface als Founder-Notification-Layer
- [ ] pgvector: Leads semantisch suchen / matchen

---

## Architektur-Prinzipien

1. **Supabase ist die einzige Wahrheit.** Alle Ventures schreiben in dieselbe DB. Kein Daten-Silo pro Venture.
2. **Supabase Edge Functions sind der Orchestrator.** Claude analysiert und entscheidet, Edge Functions führen aus.
3. **Dashboard (Vercel) ist das Founder-Interface.** Next.js App, deployt via GitHub → Vercel.
4. **Haiku für Speed, Sonnet für Qualität.** Jede Automation hat eine klare Modell-Zuweisung.
5. **Phase 1 hat Priorität.** Neue Features für Phase 2/3 erst wenn Phase 1 stabil läuft.

---

## Wie diese Datei benutzen

- **Session-Start:** Offene Punkte lesen, Status einschätzen
- **Nach jedem abgeschlossenen Schritt:** Checkbox abhaken, ggf. neue Unteraufgaben ergänzen
- **Bei Architektur-Entscheidungen:** Prinzipien prüfen
- **Neue Ventures aktivieren:** Tabelle oben aktualisieren, `venture` Enum in DB erweitern

---

*Zuletzt aktualisiert: 2026-04-03 — GitHub + Vercel Deployment, Zahlungsmodelle, Rechnungseditor*
