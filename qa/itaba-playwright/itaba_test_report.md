# Itaba Playwright — Testergebnis
**Datum:** 2026-09-08 07:56  |  **Dauer:** 272.5s

## Zusammenfassung
| | Anzahl |
|---|---|
| ✅ Bestanden | 5 |
| ❌ Fehlgeschlagen | 28 |
| ⏭️ Übersprungen (Side-Effects) | 15 |
| **Gesamt ausgeführt** | **48** |

---

## 🔴 Kritische Befunde

### 1. Preview-Token nicht gesetzt — Hauptursache (~70% der Fehler)
`ITABA_PREVIEW_TOKEN` fehlt als Umgebungsvariable. Alle preview-geschützten Seiten
(Shop, B2B, Kontakt, Retoure) leiten auf die Startseite um statt die Zielseite zu laden.
**Fix:** Token als Env-Variable `ITABA_PREVIEW_TOKEN=<token>` beim Testlauf setzen.

### 2. B2B-Dashboard — falscher Auth-Redirect
- Erwartet: `/b2b/dashboard` → redirect zu `/b2b/login`
- Erhalten: redirect zu `/` (Startseite)
- **Möglicher Bug:** Middleware erkennt B2B-Pfade ohne Preview-Token nicht und leitet global um.

### 3. Service-APIs — HTML statt JSON bei 404
- Tracking-API und Retouren-API antworten mit HTML (`<!DOCTYPE ...>`) statt JSON
- `SyntaxError: Unexpected token '<'` bei `res.json()`
- **Wahrscheinliche Ursache:** Preview-Guard greift vor dem API-Handler und gibt HTML-Seite zurück.

### 4. Kontaktformular — Button-Selektor veraltet
- `getByRole('button', { name: /Nachricht senden/i })` findet den Button nicht (Timeout 15s)
- **Mögliche Ursache:** Button-Text wurde geändert oder der Button ist per CSS unsichtbar.

---

## ✅ Was einwandfrei funktioniert

- Robots.txt + Sitemap korrekt konfiguriert
- Founder OS: Kategorien vorhanden und abrufbar
- Founder OS: Bestellungen haben Rechnungsnummern
- Founder OS: Retouren-Tabelle enthält verarbeitbare Einträge
- Kontaktseite zeigt Adresse, E-Mail und Telefon korrekt an

---

## ⏭️ Übersprungene Tests (Side-Effects — benötigen `RUN_SIDE_EFFECTS=1`)

Diese Tests wurden absichtlich nicht ausgeführt, da sie echte Daten erzeugen würden:
- B2C Checkout → echte Testbestellung erstellen + stornieren
- Bestellbestätigung mit echter Order-ID prüfen
- Retourenantrag anlegen (API POST)
- Kontaktformular mit echter Nachricht absenden
- Rechnungsnummern-Format IT-XXXXXX verifizieren

---

## Empfohlene Maßnahmen (Priorität)

| Priorität | Maßnahme |
|---|---|
| 🔴 Hoch | `ITABA_PREVIEW_TOKEN` als CI/CD-Env-Variable hinterlegen |
| 🔴 Hoch | B2B-Dashboard Auth-Redirect prüfen (→ `/b2b/login` statt `/`) |
| 🔴 Hoch | Service-APIs: Preview-Guard vor API-Handler tritt in Kraft — JSON-Response sicherstellen |
| 🟡 Mittel | Kontaktformular-Button: Selektor `Nachricht senden` prüfen / anpassen |
| 🟢 Nach Fix | `RUN_SIDE_EFFECTS=1` Lauf für Checkout- und Retouren-Abnahme |

---

## Alle Tests im Detail

| Test-Datei | Test-Name | Ergebnis |
|---|---|---|
| `b2b-auth.spec.ts` | login page exposes email/password/password-reset/register and rejects missing credentials<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `b2b-auth.spec.ts` | registration page exposes required business access fields<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `b2b-auth.spec.ts` | dashboard is protected without session<br>_`Error: [2mexpect([22m[31mpage[39m[2m).[22mtoHaveURL[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `b2c-checkout-side-effects.spec.ts` | customer can add product to cart and reach checkout with correct totals<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `b2c-checkout-side-effects.spec.ts` | pickup/bar checkout form is fillable and shows free pickup total before submit<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `b2c-checkout-side-effects.spec.ts` | bar checkout API creates Founder OS order and cleanup can cancel it | ⏭️ |
| `b2c-checkout-side-effects.spec.ts` | pickup/bar UI redirects to order success page after creating order | ⏭️ |
| `b2c-confirmation.spec.ts` | Bestätigungsseite mit unbekannter Order-ID gibt 404 zurück<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `b2c-confirmation.spec.ts` | Bestätigungsseite mit zufälliger UUID gibt 404 zurück<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `b2c-confirmation.spec.ts` | Bestätigungsseite zeigt Bestellnummer, Betrag, Kundendaten und Produkt | ⏭️ |
| `b2c-confirmation.spec.ts` | Bestätigungsseite: Weiter-shoppen-Link führt zum Shop | ⏭️ |
| `b2c-confirmation.spec.ts` | Bestätigungsseite enthält korrekte Rechnungsnummer im Format IT-XXXXXX | ⏭️ |
| `b2c-contact-form.spec.ts` | Kontaktseite lädt korrekt und zeigt alle Formularfelder<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `b2c-contact-form.spec.ts` | Kontaktseite enthält alle Betreff-Optionen im Dropdown<br>_`Error: Betreff-Option fehlt: "Bestellung / Versand"`_ | ❌ |
| `b2c-contact-form.spec.ts` | Kontaktseite zeigt Adresse, E-Mail und Telefon | ✅ |
| `b2c-contact-form.spec.ts` | Leerer Submit fokussiert Namensfeld (HTML5-Validierung)<br>_`TimeoutError: locator.click: Timeout 15000ms exceeded.`_ | ❌ |
| `b2c-contact-form.spec.ts` | Nur Name ausgefüllt: E-Mail-Feld wird als Pflichtfeld markiert<br>_`TimeoutError: locator.fill: Timeout 15000ms exceeded.`_ | ❌ |
| `b2c-contact-form.spec.ts` | Name + E-Mail ausgefüllt: Nachrichtenfeld wird als Pflichtfeld markiert<br>_`TimeoutError: locator.fill: Timeout 15000ms exceeded.`_ | ❌ |
| `b2c-contact-form.spec.ts` | Ungültige E-Mail-Adresse wird abgefangen<br>_`TimeoutError: locator.fill: Timeout 15000ms exceeded.`_ | ❌ |
| `b2c-contact-form.spec.ts` | Kontaktformular: vollständig ausgefüllt zeigt Erfolgsmeldung | ⏭️ |
| `b2c-contact-form.spec.ts` | Kontaktformular: Betreff "Rückgabe" kann ausgewählt und abgesendet werden | ⏭️ |
| `b2c-contact-form.spec.ts` | Kontaktformular: Betreff "Bestellung / Versand" kann abgesendet werden | ⏭️ |
| `b2c-return-request.spec.ts` | Retoure-Seite lädt korrekt und zeigt Pflichtfelder<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `b2c-return-request.spec.ts` | Retoure-Seite: Suchbutton ohne Eingabe triggert keine Serveranfrage (leere Validierung)<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `b2c-return-request.spec.ts` | Retoure-API: unbekannte Bestellnummer gibt 404 zurück<br>_`Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m`_ | ❌ |
| `b2c-return-request.spec.ts` | Retoure-API: fehlende Parameter geben Validierungsfehler zurück<br>_`Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeGreaterThanOrEqual[2m([22m[32mexpected[39m[2m)[22m`_ | ❌ |
| `b2c-return-request.spec.ts` | Retoure-API GET: findet echte Testbestellung und gibt korrekte Daten zurück | ⏭️ |
| `b2c-return-request.spec.ts` | Retoure-API POST: erstellt Retourenantrag für echte Testbestellung | ⏭️ |
| `b2c-return-request.spec.ts` | Retoure-UI: Bestellnummer + E-Mail eingeben zeigt Artikel-Auswahl | ⏭️ |
| `b2c-return-request.spec.ts` | Retoure-UI: Rechnungsnummer (IT-XXXXX) kann statt UUID genutzt werden | ⏭️ |
| `founder-os-data.spec.ts` | active Founder OS products match the visible B2C shop assortment<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `founder-os-data.spec.ts` | categories exist and reveal empty live categories before launch | ✅ |
| `founder-os-data.spec.ts` | recent Itaba orders have invoice numbers and expose current invoice generation gap | ✅ |
| `founder-os-data.spec.ts` | returns table contains processable Itaba returns | ✅ |
| `public-shop.spec.ts` | preview shop loads, exposes expected active products, and has no JS errors<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `public-shop.spec.ts` | category Küche exposes expected active product count<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | category Tisch exposes expected active product count<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | category Wohnen exposes expected active product count<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | category Accessoires exposes expected active product count<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | category Lebensmittel exposes expected active product count<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | all active product detail pages expose price, VAT, shipping, weight and add-to-cart<br>_`Error: ITABA_PREVIEW_TOKEN is required for preview-shop tests.`_ | ❌ |
| `public-shop.spec.ts` | service and legal pages are reachable and contain core information<br>_`Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed`_ | ❌ |
| `public-shop.spec.ts` | robots and sitemap contain expected public/private routes | ✅ |
| `service-side-effects.spec.ts` | tracking and return lookup reject unknown orders cleanly<br>_`SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`_ | ❌ |
| `service-side-effects.spec.ts` | tracking and return lookup find a real marked pickup order | ⏭️ |
| `service-side-effects.spec.ts` | return request can be created for a real marked order | ⏭️ |
| `service-side-effects.spec.ts` | contact form validates invalid input<br>_`TimeoutError: locator.click: Timeout 15000ms exceeded.`_ | ❌ |
| `service-side-effects.spec.ts` | contact form can send marked test message | ⏭️ |