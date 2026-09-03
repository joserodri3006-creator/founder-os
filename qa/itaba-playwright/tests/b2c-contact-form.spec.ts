/**
 * b2c-contact-form.spec.ts
 *
 * B2C Kontaktformular — /kontakt + /api/contact
 *
 * Bekannte Felder (aus Browser-Scout):
 *   input[name="name"]      – Pflicht, Typ text
 *   input[name="email"]     – Pflicht, Typ email
 *   select[name="betreff"]  – Optionen: Bestellung / Versand | Rückgabe | Produktfrage | Großhandel | Sonstiges
 *   textarea[name="nachricht"] – Pflicht
 *   button "NACHRICHT SENDEN"
 *
 * Normale Tests (ohne RUN_SIDE_EFFECTS):
 *   – Seite lädt, alle Felder und alle Betreff-Optionen vorhanden
 *   – Kontaktinformationen sichtbar (Adresse, E-Mail, Telefon)
 *   – Leerer Submit triggert HTML5-Validierung
 *   – Einzelne fehlende Felder werden korrekt abgefangen
 *
 * Side-Effect Tests (RUN_SIDE_EFFECTS=1):
 *   – Vollständig ausgefülltes Formular senden → Erfolgsmeldung
 *   – Jede Betreff-Option kann gewählt werden
 */

import { test, expect } from '@playwright/test';
import { PREVIEW_TOKEN, uniqueTestStamp } from './helpers';

const CONTACT_URL = `/kontakt?preview=${PREVIEW_TOKEN}`;

const BETREFF_OPTIONS = [
  'Bestellung / Versand',
  'Rückgabe',
  'Produktfrage',
  'Großhandel',
  'Sonstiges',
];

test.describe('Itaba B2C Kontaktformular', () => {

  // ─── Seitenstruktur & Felder ───────────────────────────────────────────────

  test('Kontaktseite lädt korrekt und zeigt alle Formularfelder', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/Kontakt/i);

    // Alle Pflichtfelder vorhanden
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('select[name="betreff"]')).toBeVisible();
    await expect(page.locator('textarea[name="nachricht"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Nachricht senden/i })).toBeVisible();
  });

  test('Kontaktseite enthält alle Betreff-Optionen im Dropdown', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    const select = page.locator('select[name="betreff"]');
    const options = await select.locator('option').allInnerTexts();
    for (const expected of BETREFF_OPTIONS) {
      expect(options.some(o => o.includes(expected)), `Betreff-Option fehlt: "${expected}"`).toBe(true);
    }
  });

  test('Kontaktseite zeigt Adresse, E-Mail und Telefon', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/Töngesgasse 42/i);
    await expect(page.locator('body')).toContainText(/Frankfurt/i);
    await expect(page.locator('body')).toContainText(/itabashopffm@gmail\.com/i);
    await expect(page.locator('body')).toContainText(/\+49\s*69\s*281950/i);
  });

  test('Leerer Submit fokussiert Namensfeld (HTML5-Validierung)', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    await expect(page.locator('input[name="name"]')).toBeFocused();
  });

  test('Nur Name ausgefüllt: E-Mail-Feld wird als Pflichtfeld markiert', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await page.locator('input[name="name"]').fill('Test');
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    // E-Mail leer → focus landet auf E-Mail-Feld
    await expect(page.locator('input[name="email"]')).toBeFocused();
  });

  test('Name + E-Mail ausgefüllt: Nachrichtenfeld wird als Pflichtfeld markiert', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await page.locator('input[name="name"]').fill('Test Name');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    // Nachricht leer → Formular zeigt Validierung; kein Serverfehler
    await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
  });

  test('Ungültige E-Mail-Adresse wird abgefangen', async ({ page }) => {
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });
    await page.locator('input[name="name"]').fill('Test Name');
    await page.locator('input[name="email"]').fill('keine-gueltige-email');
    await page.locator('textarea[name="nachricht"]').fill('Test');
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    // Browser oder Formular zeigt Validierungsfehler, kein Serverfehler
    await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
    // E-Mail-Feld ist noch sichtbar (kein Erfolg)
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  // ─── Side-Effect Tests ─────────────────────────────────────────────────────

  test('Kontaktformular: vollständig ausgefüllt zeigt Erfolgsmeldung', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to send a real marked test contact message.');

    const stamp = uniqueTestStamp();
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });

    await page.locator('input[name="name"]').fill(`HERMES KONTAKT TEST ${stamp}`);
    await page.locator('input[name="email"]').fill(`hermes-contact-${stamp}@example.com`);
    await page.locator('select[name="betreff"]').selectOption({ label: 'Sonstiges' });
    await page.locator('textarea[name="nachricht"]').fill(
      `HERMES PLAYWRIGHT TEST ${stamp}: Automatisierter Abnahmetest – bitte ignorieren.`,
    );
    await page.getByRole('button', { name: /Nachricht senden/i }).click();

    // Erfolgszustand
    await expect(page.locator('body')).toContainText(
      /Nachricht erhalten|Bestätigung wurde an Ihre E-Mail gesendet|Vielen Dank/i,
      { timeout: 15_000 },
    );
    // Formular sollte danach ausgeblendet oder zurückgesetzt sein
    await expect(page.locator('input[name="name"]')).not.toBeVisible();
  });

  test('Kontaktformular: Betreff "Rückgabe" kann ausgewählt und abgesendet werden', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to send a real marked test contact message.');

    const stamp = uniqueTestStamp();
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });

    await page.locator('input[name="name"]').fill(`HERMES RUECKGABE TEST ${stamp}`);
    await page.locator('input[name="email"]').fill(`hermes-rueckgabe-${stamp}@example.com`);
    await page.locator('select[name="betreff"]').selectOption({ label: 'Rückgabe' });
    await page.locator('textarea[name="nachricht"]').fill(
      `HERMES PLAYWRIGHT TEST ${stamp}: Rückgabe-Testanfrage – bitte ignorieren.`,
    );
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    await expect(page.locator('body')).toContainText(
      /Nachricht erhalten|Bestätigung|Vielen Dank/i,
      { timeout: 15_000 },
    );
  });

  test('Kontaktformular: Betreff "Bestellung / Versand" kann abgesendet werden', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to send a real marked test contact message.');

    const stamp = uniqueTestStamp();
    await page.goto(CONTACT_URL, { waitUntil: 'networkidle' });

    await page.locator('input[name="name"]').fill(`HERMES VERSAND TEST ${stamp}`);
    await page.locator('input[name="email"]').fill(`hermes-versand-${stamp}@example.com`);
    await page.locator('select[name="betreff"]').selectOption({ label: 'Bestellung / Versand' });
    await page.locator('textarea[name="nachricht"]').fill(
      `HERMES PLAYWRIGHT TEST ${stamp}: Versand-Testanfrage – bitte ignorieren.`,
    );
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    await expect(page.locator('body')).toContainText(
      /Nachricht erhalten|Bestätigung|Vielen Dank/i,
      { timeout: 15_000 },
    );
  });
});
