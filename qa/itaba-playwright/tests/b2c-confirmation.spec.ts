/**
 * b2c-confirmation.spec.ts
 *
 * B2C Bestätigungsseite (/bestellung/abholung?id=<uuid>)
 *
 * Normale Tests (ohne RUN_SIDE_EFFECTS):
 *   – 404 bei unbekannter / gefälschter Order-ID
 *
 * Side-Effect Tests (RUN_SIDE_EFFECTS=1):
 *   – Bestätigungsseite einer echten Abholung-Testbestellung zeigt
 *     Bestellnummer, Gesamtbetrag, Kundenname, Produkte, Abholadresse
 *   – „Weiter shoppen"-Link führt zurück zum Shop
 *   – Seite enthält keine JS-Console-Errors
 */

import { test, expect } from '@playwright/test';
import { cancelTestOrder, createBarPickupOrderViaApi, openPreviewShop, PREVIEW_TOKEN } from './helpers';

test.describe('Itaba B2C Bestellbestätigung', () => {

  // ─── Nicht-destruktive Tests ────────────────────────────────────────────────

  test('Bestätigungsseite mit unbekannter Order-ID gibt 404 zurück', async ({ page }) => {
    await openPreviewShop(page); // setzt Preview-Cookie
    const res = await page.goto(`/bestellung/abholung?id=HERMES-FAKE-ORDER-ID&preview=${PREVIEW_TOKEN}`, {
      waitUntil: 'networkidle',
    });
    const body = page.locator('body');
    await expect(body).toContainText(/nicht gefunden|404/i);
  });

  test('Bestätigungsseite mit zufälliger UUID gibt 404 zurück', async ({ page }) => {
    await openPreviewShop(page);
    await page.goto(`/bestellung/abholung?id=00000000-0000-0000-0000-000000000000&preview=${PREVIEW_TOKEN}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('body')).toContainText(/nicht gefunden|404/i);
  });

  // ─── Side-Effect Tests (echte Testbestellung) ───────────────────────────────

  test('Bestätigungsseite zeigt Bestellnummer, Betrag, Kundendaten und Produkt', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const order = await createBarPickupOrderViaApi(page.request);
    try {
      // Bestätigungsseite — Preview-Token als Query-Parameter mitgeben
      const confirmPath = (order.redirect as string).replace('https://itaba.de', '');
      await openPreviewShop(page); // setzt Cookie im Context
      const resp = await page.goto(`${confirmPath}&preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle', timeout: 20_000 });

      // HTTP-Status
      expect(resp?.status()).toBe(200);

      // Kerninhalte der Bestätigungsseite
      await expect(page.locator('h1')).toContainText(/Bestellung vorgemerkt/i);
      await expect(page.locator('body')).toContainText(/IT-/); // Rechnungsnummer
      await expect(page.locator('body')).toContainText(/29,90\s*€/i); // Gesamtbetrag
      await expect(page.locator('body')).toContainText(/HERMES PLAYWRIGHT TEST/i); // Kundenname
      await expect(page.locator('body')).toContainText(/Teller rund/i); // Produkt
      await expect(page.locator('body')).toContainText(/Abholung/i); // Versandmethode
      await expect(page.locator('body')).toContainText(/Kostenlos/i); // Kostenlose Abholung

      // Abholinformationen
      await expect(page.locator('body')).toContainText(/Töngesgasse 42/i);
      await expect(page.locator('body')).toContainText(/Frankfurt/i);
      await expect(page.locator('body')).toContainText(/bar/i); // Barzahlung

      // Weiter-shoppen-Link vorhanden
      await expect(page.getByRole('link', { name: /Weiter shoppen/i })).toBeVisible();

      // Keine JS-Fehler
      expect(consoleErrors, `Console errors on confirmation page: ${consoleErrors.join('; ')}`).toHaveLength(0);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('Bestätigungsseite: Weiter-shoppen-Link führt zum Shop', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const order = await createBarPickupOrderViaApi(page.request);
    try {
      const confirmPath = (order.redirect as string).replace('https://itaba.de', '');
      await openPreviewShop(page);
      await page.goto(`${confirmPath}&preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.getByRole('link', { name: /Weiter shoppen/i }).click();
      await expect(page).toHaveURL(/\/shop/);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('Bestätigungsseite enthält korrekte Rechnungsnummer im Format IT-XXXXXX', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const order = await createBarPickupOrderViaApi(page.request);
    try {
      const confirmPath = (order.redirect as string).replace('https://itaba.de', '');
      await openPreviewShop(page);
      await page.goto(`${confirmPath}&preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle', timeout: 20_000 });
      const bodyText = await page.locator('body').innerText();
      const match = bodyText.match(/\bIT-[A-Z0-9]{4,8}\b/);
      expect(match, 'Rechnungsnummer im Format IT-XXXXX nicht gefunden').toBeTruthy();
      expect(match![0]).toMatch(/^IT-[A-Z0-9]{4,8}$/);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });
});
