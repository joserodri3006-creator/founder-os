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
| Founder-Interface | Supabase Dashboard / direkt | Kein Notification-Layer in Phase 1 |
| E-Commerce | WooCommerce REST API | Blazed Outfitters, Brandary Shop |
| E-Mail | Resend.com | Transaktional + Campaigns |
| Social Media | Buffer API | Content-Scheduling |
| Dokumente | Google Drive | Reports, Vorlagen, Ablage |
| Interface | TBD (React App oder bestehendes Tool) | Dashboard / UI |

**KI-Modell-Regel:**
- `claude-sonnet-4-6` — Lead-Analyse, Content-Generierung, komplexe Entscheidungen
- `claude-haiku-4-5-20251001` — Klassifizierung, Tagging, Routing, Polling

---

## Aktueller Stand: Phase 1 — Fundament

**Gesamtfortschritt:** Schritt 2 von 4 — Dashboard live

### Erledigte Schritte
- [x] Supabase Schema für Online First Lead Pipeline entworfen (`supabase_schema.sql`)
- [x] Supabase Projekt erstellt + Schema eingespielt
- [x] DB-Verbindung verifiziert (Tabellen: leads, customers, lead_activities, mail_templates, orders, system_config + 4 Views)

### Supabase DB — Aktuelles Schema (Stand 2026-03-27)

**Tabellen:** `leads`, `customers`, `lead_activities`, `mail_templates`, `orders`, `order_activities`, `system_config`
**Views:** `v_lead_pipeline`, `v_due_follow_ups`, `v_daily_new_leads`, `v_reactivation_today`
**Enums:** `venture`, `lead_status`, `lead_source`, `order_status`
**orders-Spalten (zuletzt ergänzt):** `invoice_number`, `invoice_generated_at`, `invoice_html`
**Noch offen:** pgvector Embedding-Spalte in `leads` (für Phase 2 KI-Features)

### DB-Verbindung (für Claude Code)

```
Host:     aws-1-eu-west-1.pooler.supabase.com
Port:     6543
DB:       postgres
User:     postgres.bshuqljbanmphmjyicdc
Password: [im settings.json URL-encoded hinterlegt]
```

MCP-Config: `~/.claude/settings.json` → `@modelcontextprotocol/server-postgres`
Direktverbindung Node.js: password = `Jlraxx3006?!` (Klammern in URL-Connection weglassen)

### Offene Schritte (in Reihenfolge)

#### ~~Schritt 1 — Supabase Projekt anlegen~~ ✅
- [x] Supabase Projekt erstellt
- [x] Schema eingespielt und verifiziert
- [ ] pgvector Extension aktivieren (Supabase Dashboard → Extensions → vector)
- [ ] Anon Key + Service Role Key sichern (für n8n Credentials)

#### Schritt 2 — Lead Pipeline bauen (Online First)
- [x] Edge Function: Lead-Eingang (Webformular → Supabase `leads`) → deployed + getestet
- [x] Edge Function: Lead-Qualifizierung mit Claude (Haiku: Klassifizierung, Sonnet: Analyse) → deployed + getestet

#### Dashboard (Next.js) — live auf localhost:3000
- [x] `/dashboard` — KPI Kacheln + neueste Leads
- [x] `/leads` — Pipeline mit Status-Änderung inline, Neuer Lead Modal, CSV Import
- [x] `/drafts` — KI-Drafts reviewen, editieren, freigeben & senden
- [x] Alle DB-Reads über API Routes (Service Role Key, RLS umgangen)
- [x] Status-Workflow Webhook (status-workflow Edge Function)
- [x] E-Mail-Versand über Resend (Domain onlinefirst.eu verifiziert, echte Absenderadressen aktiv)
- [x] Rechnungsgenerierung: HTML-Rechnung pro Venture, Download + E-Mail-Versand aus Auftragsdetail
- [x] order-workflow Edge Function (Status-Webhooks + automatische Mails)
- [x] daily-summary Edge Function (täglich 18:00 UTC via pg_cron)
- [ ] Deployment (Vercel o.ä.)

#### Schritt 3 — Operations Agent MVP (Brandary)
- [ ] Brandary-spezifisches Schema entwerfen (Druckaufträge, Material, Status)
- [ ] Edge Function: Bestelleingang → Supabase
- [ ] Edge Function: Rechnungs-Generierung (→ Google Drive)

---

## Dateistruktur

```
founder-os/
├── CLAUDE.md                    # Diese Datei — immer aktuell halten
├── supabase_schema.sql          # Online First Lead Pipeline Schema
├── schemas/                     # Weitere Supabase Schemas (pro Venture)
│   ├── brandary_schema.sql
│   └── ...
├── n8n/                         # n8n Workflow Exports (.json)
│   ├── lead_pipeline.json
│   └── ...
├── prompts/                     # Claude System Prompts (wiederverwendbar)
│   ├── lead_qualifier.md
│   └── ...
└── docs/                        # Entscheidungen, Architektur-Notizen
    └── architecture.md
```

---

## Architektur-Prinzipien

1. **Supabase ist die einzige Wahrheit.** Alle Ventures schreiben in dieselbe DB.
   Kein Daten-Silo pro Venture.

2. **Supabase Edge Functions sind der Orchestrator.** Keine Business-Logik direkt in Claude-Prompts —
   Claude analysiert und entscheidet, Edge Functions führen aus. Kein externer Service nötig.

3. **Telegram ist das Founder-Interface.** Keine eigene App bauen, solange
   Telegram alle Anforderungen erfüllt.

4. **Haiku für Speed, Sonnet für Qualität.** Jede Automation hat eine klare
   Modell-Zuweisung. Kosten im Blick behalten.

5. **Phase 1 hat Priorität.** Neue Features für Phase 2/3 erst wenn Phase 1
   stabil läuft und Cashflow gesichert ist.

---

## Wie diese Datei benutzen

- **Session-Start:** Offene Schritte lesen, Status einschätzen
- **Nach jedem abgeschlossenen Schritt:** Checkbox abhaken, ggf. neue Unteraufgaben ergänzen
- **Bei Architektur-Entscheidungen:** Prinzipien prüfen, Entscheidung in `docs/` dokumentieren
- **Neue Ventures aktivieren:** Tabelle oben aktualisieren, neues Schema unter `schemas/` anlegen

---

*Zuletzt aktualisiert: 2026-03-26 — Architektur-Entscheidung: n8n → Supabase Edge Functions*
