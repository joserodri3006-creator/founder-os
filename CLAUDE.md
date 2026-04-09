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

## Supabase DB — Aktuelles Schema (Stand 2026-04-09)

**Tabellen:**
- `leads` — Lead-Pipeline (alle Ventures)
- `customers` — Kundenstamm (alle Ventures), inkl. `notes`, `archived_at`
- `lead_activities` — Aktivitäten pro Lead
- `mail_templates` — E-Mail-Vorlagen
- `orders` — Aufträge (alle Ventures), inkl. `notes`, `archived_at`
- `order_activities` — Aktivitäten/Audit Trail pro Auftrag
- `payment_models` — Zahlungsmodelle pro Venture (flexibel, JSON-Steps)
- `system_config` — Zentrale Konfiguration (KI-Suche, Venture-Infos, etc.)
- `attachments` — Anhänge für orders/customers/products (Supabase Storage)
- `products` — Produkte (alle Ventures), inkl. `notes`, `images` JSONB
- `product_types` — Produkttypen pro Venture
- `product_brands` — Marken pro Venture
- `product_categories` — Kategorie-Hierarchie
- `product_tags` — Tags pro Venture
- `product_variants` — Varianten-Kombinationen
- `product_variant_options` — Varianten-Optionen
- `inventory_movements` — Lagerbewegungshistorie
- `product_category_map` — Produkt ↔ Kategorie (n:m)
- `product_tag_map` — Produkt ↔ Tag (n:m)
- `user_venture_roles` — User-Permissions pro Venture
- `user_invites` — Offene Team-Einladungen

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
| `sale-price-scheduler` | pg_cron 00:01 UTC | Aktionspreise aktivieren/deaktivieren (sync_status=pending) |
| `product-sync` | DB Webhook (products UPDATE sync_status=pending) | Produkt zu WooCommerce REST API synchronisieren |

---

## Dashboard (Next.js) — Feature-Stand

### Seiten
- `/dashboard` — KPI-Kacheln pro Venture, neueste Leads
- `/leads` — Pipeline, Status inline, Neuer Lead Modal, CSV Import, Duplikat-Markierung, Bearbeiten/Kopieren/Archivieren/Löschen
- `/leads/[id]` — Lead-Detail mit Aktivitäten
- `/drafts` — KI-Drafts reviewen, editieren, senden (per Venture gefiltert)
- `/kunden` — Kundenliste, Bearbeiten/Kopieren/Archivieren/Löschen, Archiv-Toggle
- `/kunden/[id]` — Kundendetail: Felder editierbar, Aufträge, Notizen, Anhänge
- `/auftraege` — Auftragsliste mit Status + Wert, Bearbeiten/Kopieren/Archivieren/Löschen, Archiv-Toggle
- `/auftraege/[id]` — Auftragsdetail: Status-Timeline, Zahlungsschritte, Rechnung, Aktivitäten, Notizen, Anhänge
- `/produkte` — Produktliste, Kopieren/Archivieren/Löschen (→ siehe Produktverwaltung unten)
- `/produkte/[id]` — Produktdetail (→ siehe Produktverwaltung unten)
- `/produkte/neu` — Neues Produkt anlegen
- `/produkte/kategorien` — Kategorie-Baum verwalten (3-stufig, P1.2 ✅)
- `/produkte/sync-log` — WooCommerce Sync-Log (P1.5 ✅)
- `/einstellungen` — KI-Suche, Venture-Infos (Firmendaten für Rechnungen), WooCommerce-Config, allg. Config
- `/einstellungen/zahlungsmodelle` — Zahlungsmodelle pro Venture verwalten
- `/einstellungen/team` — Teammitglieder einladen + Rollen/Permissions verwalten
- `/einstellungen/produkttypen` — Produkttypen pro Venture konfigurieren
- `/einstellungen/marken` — Marken/Brands pro Venture verwalten
- `/einstellungen/steuern` — Steuerklassen + Steuersätze pro Venture (P1.4 ✅)

### Globale Features
- **Venture Switcher** in Sidebar — persistiert in localStorage, alle Seiten reagieren
- **Mobile Responsive** — Sidebar als Drawer-Overlay auf Mobile, Hamburger-Menü, horizontales Table-Scrolling, responsive Padding
- **Resend E-Mail** — Domain onlinefirst.eu verifiziert, echte Absender aktiv
- **Rechnungsgenerierung** — HTML-Rechnung, editierbar (Positionen, Empfänger, MwSt.), Download + E-Mail-Versand
- **Zahlungsmodelle** — flexibel per Venture, Steps mit Trigger + Fälligkeit, Toggle pro Schritt
- **Anhänge** — Datei-Upload/Download/Löschen mit optionaler Beschreibung (Supabase Storage Bucket `attachments`)
- **Notizen** — Freitextfeld mit Auto-Save (1s Debounce) auf Kunden, Aufträgen, Produkten
- **system_config upsert** — neue Keys werden automatisch angelegt

---

## Produktverwaltung — Feature-Stand (Stand 2026-04-09)

### Was die Produktverwaltung aktuell kann

#### Produktliste (`/produkte`)
- Alle Produkte des aktiven Ventures anzeigen
- Filter: Freitextsuche (Name/SKU), Status (Entwurf / Aktiv / Archiviert)
- Spalten: Produktbild, Name, Marke, Typ, SKU, Preis (mit Streichpreis), Status
- Aktionen pro Zeile: **Bearbeiten** (→ Detailseite), **Kopieren** (Duplikat mit neuem Namen, Status Entwurf), **Archivieren** (Bestätigung), **Löschen** (Bestätigung, inkl. Storage-Images)

#### Neues Produkt (`/produkte/neu`)
- Felder: Name, SKU, Kurzbeschreibung, Beschreibung
- Preisfelder: Verkaufspreis, Vergleichspreis (Streichpreis), Einkaufspreis
- Flags: Lagerbestand tracken, Featured, Status (Entwurf/Aktiv)
- Gewicht (erscheint nur wenn Produkttyp `has_weight = true`)
- Produkttyp & Marke zuweisen (Dropdowns, per Venture)
- Kategorien (Multi-Select aus Kategorie-Baum)
- Tags (Freitext, Enter-Eingabe, per Venture gescoped)
- Speichert und leitet auf `/produkte/[id]` weiter

#### Produktdetail (`/produkte/[id]`)

**Grunddaten (editierbar, Auto-Save beim Blur):**
- Name, SKU, Status (Entwurf/Aktiv/Archiviert)
- Kurzbeschreibung, Beschreibung (Textarea)
- Verkaufspreis, Vergleichspreis, Einkaufspreis
- Gewicht (nur bei has_weight)
- Featured-Toggle
- Lagerbestand-Toggle

**Aktionspreis (P1.1 ✅):**
- Aktionspreis (€) mit Datumsteuerung (sale_from / sale_until)
- Aktivitäts-Badge (✓ Aktionspreis aktiv / Inaktiv)
- Shop-Vorschau mit Streichpreis
- sale-price-scheduler Edge Function setzt täglich sync_status=pending

**SEO (P1.3 ✅):**
- Slug (editierbar, auto-generiert aus Name)
- Meta-Titel (60 Zeichen Counter)
- Meta-Beschreibung (160 Zeichen Counter)
- Google SERP-Vorschau (live)
- Open Graph Felder (OG-Titel, OG-Beschreibung)
- Canonical URL + noindex Toggle

**Bilder:**
- Upload via Klick oder Drag & Drop (Supabase Storage Bucket `product-images`)
- Speicherpfad: `{venture}/{product_id}/{timestamp}.{ext}`
- Vorschau aller Bilder, einzeln löschbar
- Reihenfolge: Erstes Bild = Hauptbild

**Varianten (nur wenn Produkttyp `has_variants = true`):**
- Varianten-Optionen anlegen (z.B. „Größe": S, M, L, XL)
- Mehrere Optionen möglich (z.B. Größe + Farbe)
- „Varianten generieren" erzeugt automatisch alle Kombinationen als Zeilen
- Pro Variante editierbar: SKU, Preis, Lagerbestand, Aktiv-Toggle
- Varianten-Daten per PATCH `/api/produkte/[id]/varianten` gespeichert

**Lagerbewegungen (nur wenn `has_inventory = true`):**
- Bewegungshistorie der letzten 100 Einträge (Typ, Menge, Vorher/Nachher-Bestand, Notiz, Datum)
- Neue Bewegung erfassen: Typ (Eingang/Ausgang/Korrektur/Retoure), Menge, Variante auswählen, Notiz
- Farbkodierung: Eingang grün, Ausgang rot, Korrektur blau, Retoure orange

**Tags:**
- Tags hinzufügen (Enter), entfernen (×)
- Tags werden per-venture in `product_tags` angelegt (upsert)

**Notizen:**
- Freitextfeld mit Auto-Save (1s Debounce)

**Anhänge:**
- Datei-Upload/Download/Löschen mit optionaler Beschreibung (Bucket `attachments`)

**Rechte Sidebar:**
- Status-Selector (Entwurf/Aktiv/Archiviert)
- Produkttyp, Marke, Erstellt-Datum (nur lesen)
- Steuerklassen-Selector (P1.4 ✅)
- Storefront-Sync Status + Auslöse-Button (P1.5 ✅)
- Tags-Verwaltung
- Notizen-Feld
- Anhänge-Panel
- Produkt löschen (mit Bestätigung, löscht auch Storage-Bilder)

#### Kategorien (`/produkte/kategorien`) — P1.2 ✅
- **3-stufige** Kategoriehierarchie (L1 → L2 → L3)
- Level-Badges (L1 Navy, L2 Gold, L3 Grau)
- Expand/Collapse pro Ebene
- Slug + Pfad automatisch via DB-Trigger generiert
- UI verhindert 4. Ebene (Parent-Selector zeigt nur L1+L2)
- Level-Preview beim Anlegen mit Pfad-Vorschau
- Sortierung per ▲▼ (swap sort_order)
- Bearbeiten-Modal: Name, Beschreibung, Meta-Titel (60 Zeichen), Meta-Description (160 Zeichen)
- Löschen nur möglich wenn keine Unterkategorien vorhanden

#### Produkttypen (`/einstellungen/produkttypen`)
- Produkttypen pro Venture definieren
- Flags: `has_variants` (Varianten-Tab erscheint), `has_inventory` (Lager-Tab erscheint), `has_weight` (Gewichtsfeld erscheint)
- Anlegen, umbenennen, löschen

#### Marken (`/einstellungen/marken`)
- Marken pro Venture verwalten
- Felder: Name, Slug (auto-generiert), Logo-URL
- Logo-Vorschau mit Fallback auf Initialen
- Anlegen, bearbeiten, löschen

### Datenbank-Tabellen (Produkte)

| Tabelle | Zweck |
|---|---|
| `products` | Kernprodukt-Daten inkl. `images` JSONB-Array |
| `product_types` | Typ-Definitionen pro Venture (Flags) |
| `product_brands` | Marken pro Venture |
| `product_categories` | Kategorie-Hierarchie (parent_id, level, path, slug, SEO-Felder) |
| `product_tags` | Tags pro Venture (unique per name+venture) |
| `product_variants` | Varianten-Kombinationen (SKU, Preis, Bestand) |
| `product_variant_options` | Varianten-Optionen (z.B. Größe, Farbe) |
| `inventory_movements` | Lager-Bewegungshistorie |
| `product_category_map` | Produkt ↔ Kategorie (n:m) |
| `product_tag_map` | Produkt ↔ Tag (n:m) |
| `tax_classes` | Steuerklassen pro Venture (Standard 19%, Ermäßigt 7%, Steuerfrei 0%) |
| `tax_rates` | Steuersätze pro Klasse + Land |
| `product_sync_log` | WooCommerce Sync-Protokoll pro Produkt |

### Storage Buckets (Produkte)

| Bucket | Inhalt | Pfad |
|---|---|---|
| `product-images` | Produktbilder | `{venture}/{product_id}/{timestamp}.{ext}` |
| `attachments` | Anhänge für Produkte/Kunden/Aufträge | `{entity_type}/{entity_id}/{timestamp}_{filename}` |

### API-Routen (Produkte)

| Route | Methoden | Funktion |
|---|---|---|
| `/api/produkte` | GET, POST | Liste + Neu anlegen |
| `/api/produkte/[id]` | GET, PATCH, DELETE | Detail, Update, Löschen |
| `/api/produkte/[id]/copy` | POST | Duplizieren (neuer Name, Slug, Status=draft) |
| `/api/produkte/[id]/varianten` | POST | Varianten-Optionen + Kombinationen upserten |
| `/api/produkte/[id]/lager` | GET, POST | Lagerbewegungen lesen + erfassen |
| `/api/produkte/[id]/bilder` | POST, PATCH, DELETE | Bild hochladen, sortieren, löschen |
| `/api/produkt-typen` | GET, POST | Produkttypen |
| `/api/produkt-typen/[id]` | PATCH, DELETE | Produkttyp bearbeiten/löschen |
| `/api/produkt-marken` | GET, POST | Marken |
| `/api/produkt-marken/[id]` | PATCH, DELETE | Marke bearbeiten/löschen |
| `/api/produkt-kategorien` | GET, POST | Kategorien |
| `/api/produkt-kategorien/[id]` | PATCH, DELETE | Kategorie bearbeiten/löschen |
| `/api/produkt-tags` | GET, POST | Tags (upsert) |
| `/api/steuerklassen` | GET, POST | Steuerklassen pro Venture |
| `/api/steuerklassen/[id]` | PATCH, DELETE | Steuerklasse bearbeiten/löschen |
| `/api/produkte/sync-log` | GET, POST | Sync-Log lesen, Re-Trigger |

### Was noch fehlt / nicht implementiert

- [x] **WooCommerce-Sync** — Produkte aus/in Blazed Outfitters / Brandary Shop synchronisieren ← P1.5 ✅
- [ ] **Bestandsalarm** — Benachrichtigung wenn Lagerbestand unter Minimum fällt
- [ ] **Produktbilder neu sortieren** — Drag & Drop Reihenfolge in der UI
- [ ] **Bulk-Aktionen** — Mehrere Produkte gleichzeitig archivieren/löschen/exportieren
- [ ] **CSV/Excel Export** — Produktliste exportieren
- [ ] **Produkt-Aktivitätslog** — Änderungshistorie analog zu Aufträgen

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

*Zuletzt aktualisiert: 2026-04-09 — P1 Features vollständig: P1.1 Aktionspreis, P1.2 Kategorien 3-Ebenen, P1.3 SEO-Felder, P1.4 Steuer-Konfiguration, P1.5 Storefront-Sync (WooCommerce)*
