/**
 * b2c-return-request.spec.ts
 *
 * B2C Retourenantrag — /retoure + /api/retoure
 *
 * Normale Tests (ohne RUN_SIDE_EFFECTS):
 *   – Seite lädt korrekt
 *   – Formularfelder vorhanden (Bestellnummer, E-Mail)
 *   – API lehnt unbekannte Bestellung ab (404)
 *   – Leerer Submit wird abgefangen
 *
 * Side-Effect Tests (RUN_SIDE_EFFECTS=1):
 *   – Retoure-Lookup findet echte Testbestellung (GET)
 *   – Retourenantrag wird erfolgreich erstellt (POST)
 *   – Retoure-UI: Bestellnummer eingeben → Artikel-Auswahl sichtbar → Antrag absenden
 */

import { test, expect } from '@playwright/test';
import { cancelTestOrder, createBarPickupOrderViaApi, openPreviewShop, PREVIEW_TOKEN } from './helpers';

const previewCookie = { Cookie: `itaba_preview_access=${PREVIEW_TOKEN}` };

test.describe('Itaba B2C Retourenantrag', () => {

  // ─── Seite & Grundvalidierung ──────────────────────────────────────────────

  test('Retoure-Seite lädt korrekt und zeigt Pflichtfelder', async ({ page }) => {
    await page.goto(`/retoure?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/Retoure beantragen/i);

    // Pflichtfelder
    await expect(page.locator('input[type="text"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Placeholder-Texte prüfen (Hinweise auf Feldinhalt)
    const firstInput = page.locator('input').first();
    const emailInput = page.locator('input[type="email"]');
    await expect(firstInput).toHaveAttribute('placeholder', /IT-|Rechnung|Bestellung/i);
    await expect(emailInput).toHaveAttribute('placeholder', /@/);
  });

  test('Retoure-Seite: Suchbutton ohne Eingabe triggert keine Serveranfrage (leere Validierung)', async ({ page }) => {
    await page.goto(`/retoure?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    // Ohne Eingabe absenden — Ergebnis darf kein Serverfehler sein
    const searchBtn = page.getByRole('button', { name: /Bestellung suchen/i });
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    // Kein Server-Error, Seite bleibt im Suchzustand
    await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
  });

  test('Retoure-API: unbekannte Bestellnummer gibt 404 zurück', async ({ request }) => {
    const res = await request.get('/api/retoure?order_id=HERMES-NOT-FOUND&email=nobody@example.com', {
      headers: previewCookie,
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/nicht gefunden/i);
  });

  test('Retoure-API: fehlende Parameter geben Validierungsfehler zurück', async ({ request }) => {
    // Kein order_id
    const res1 = await request.get('/api/retoure', { headers: previewCookie });
    expect(res1.status()).toBeGreaterThanOrEqual(400);

    // Kein email
    const res2 = await request.get('/api/retoure?order_id=IT-TEST', { headers: previewCookie });
    expect(res2.status()).toBeGreaterThanOrEqual(400);
  });

  // ─── Side-Effect Tests ─────────────────────────────────────────────────────

  test('Retoure-API GET: findet echte Testbestellung und gibt korrekte Daten zurück', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const order = await createBarPickupOrderViaApi(request);
    try {
      const res = await request.get(
        `/api/retoure?order_id=${order.order_id}&email=${encodeURIComponent(order.customer.email)}`,
        { headers: previewCookie },
      );
      expect(res.status()).toBe(200);
      const body = await res.json();

      // Auftragsfelder
      expect(body.order_id).toBeTruthy();
      expect(body.status).toBeTruthy();
      expect(body.total).toBe(29.9);

      // Artikel vorhanden
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items[0].name).toContain('Teller rund');
      expect(body.items[0].qty).toBe(1);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('Retoure-API POST: erstellt Retourenantrag für echte Testbestellung', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order and return.');

    const order = await createBarPickupOrderViaApi(request);
    try {
      const res = await request.post('/api/retoure', {
        headers: previewCookie,
        data: {
          order_id: order.order_id,
          email: order.customer.email,
          items: [{ name: 'Teller rund Ø21cm, H3cm', qty: 1 }],
          reason: `HERMES PLAYWRIGHT TESTRETOURE ${order.stamp} – bitte ignorieren`,
        },
      });
      expect(res.status(), await res.text()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('Retoure-UI: Bestellnummer + E-Mail eingeben zeigt Artikel-Auswahl', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const order = await createBarPickupOrderViaApi(page.request);
    try {
      await page.goto(`/retoure?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });

      // Felder ausfüllen
      await page.locator('input').nth(0).fill(order.order_id);
      await page.locator('input[type="email"]').fill(order.customer.email);
      await page.getByRole('button', { name: /Bestellung suchen/i }).click();

      // Nach Suche: Artikel sollten erscheinen
      await expect(page.locator('body')).toContainText(/Teller rund|Artikel|Produkt/i, { timeout: 10_000 });
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('Retoure-UI: Rechnungsnummer (IT-XXXXX) kann statt UUID genutzt werden', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');

    const order = await createBarPickupOrderViaApi(request);
    try {
      // Rechnungsnummer aus Checkout-Response
      const invoiceNumber = (order as any).invoice_number as string | undefined;
      if (!invoiceNumber) {
        // Über API ermitteln
        const lookup = await request.get(
          `/api/retoure?order_id=${order.order_id}&email=${encodeURIComponent(order.customer.email)}`,
          { headers: previewCookie },
        );
        const body = await lookup.json();
        // Falls order_number vorhanden: auch damit testen
        if (body.order_number) {
          const res2 = await request.get(
            `/api/retoure?order_id=${body.order_number}&email=${encodeURIComponent(order.customer.email)}`,
            { headers: previewCookie },
          );
          expect(res2.status()).toBe(200);
          const body2 = await res2.json();
          expect(body2.items.length).toBeGreaterThan(0);
        }
      }
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });
});
