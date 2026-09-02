# Itaba Playwright Acceptance Tests

Standalone Playwright-Suite für den Itaba-Shop und die Founder-OS-Datenbasis.

## Was wird getestet?

- Öffentlicher Shop/Preview: Produktliste, Kategorien, Produktseiten, Service- und Rechtstexte, robots.txt, sitemap.xml
- B2C: Produkt → Warenkorb → Kasse, Versand/Abholung, PayPal-Option, Abholung/Barzahlung
- Side Effects optional: echte markierte Testbestellung, Sendungsverfolgung, Retoure, Kontaktformular-Testnachricht
- B2B: Login/Register-Oberfläche und geschützter Dashboard-Redirect ohne Session
- Founder OS/Supabase: aktive Produkte, Kategorien, Orders, Retouren, Rechnungsfelder

## Setup

```bash
cd /opt/data/projects/itaba-playwright-tests
PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright npx playwright install chromium
npm test
```

In dieser Hermes-Umgebung ist Chromium bereits unter `/opt/hermes/.playwright` installiert.

## Wichtige Umgebungsvariablen

```bash
ITABA_BASE_URL=https://itaba.de
ITABA_PREVIEW_TOKEN=<preview-token>
SUPABASE_URL=<supabase-url>
SUPABASE_KEYS_FILE=/opt/data/env.brandary_supabase/supabase_keys.txt
# oder statt Datei:
SUPABASE_SERVICE_ROLE_KEY=...
```

Secrets werden nicht im Repo gespeichert.

## Befehle

```bash
# alle read-only/harmlosen Tests + Admin-Datenprüfungen
PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright npm test

# echte Testbestellung/Retoure/Kontaktmail auslösen
PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright RUN_SIDE_EFFECTS=1 npm run test:side-effects

# HTML-Report anzeigen
npm run test:report
```

## Aktueller erwarteter Fail

Diese Suite ist als Abnahme-Guard formuliert. Aktuell schlägt noch dieser Test fehl, bis die Launch-Fixes erledigt sind:

1. `recent Itaba orders have invoice numbers and expose current invoice generation gap`  
   Erwartung: Rechnung wurde generiert (`invoice_generated_at`, `invoice_html`).  
   Aktuell: Rechnungsnummer existiert, Rechnung/HTML/Versand fehlen bei aktuellen Itaba-Orders.

Kategorie-Test dokumentiert aktuell außerdem: Küche und Accessoires haben 0 aktive Produkte. Das ist kein technischer Fail, aber Launch-Hinweis.

Hinweis: Der UI-Test für Abholung/Barzahlung redirectet im automatisierten Playwright-Lauf inzwischen korrekt auf `/bestellung/abholung?id=...`; die Testbestellung wird danach automatisch storniert.

## Testdaten-Cleanup

Side-Effect-Tests markieren erzeugte Testbestellungen automatisch als `storniert` und schreiben `HERMES PLAYWRIGHT TEST` in die Notizen. Testretouren werden über den Grund ebenfalls klar markiert.
