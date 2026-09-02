import { test, expect } from '@playwright/test';
import { PREVIEW_TOKEN } from './helpers';

test.describe('Itaba B2B public authentication', () => {
  test('login page exposes email/password/password-reset/register and rejects missing credentials', async ({ page }) => {
    await page.goto(`/b2b/login?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/Itaba\s*B2B Partner Portal/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Anmelden/i })).toBeVisible();
    await expect(page.getByText(/Passwort vergessen/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Registrieren/i })).toBeVisible();
  });

  test('registration page exposes required business access fields', async ({ page }) => {
    await page.goto(`/b2b/register?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/B2B Zugang anfragen/i);
    await expect(page.locator('body')).toContainText(/Für Restaurants, Hotels und Einzelhändler/i);
    for (const label of ['Vorname', 'Nachname', 'Unternehmen', 'E-Mail', 'Passwort wählen']) {
      await expect(page.getByText(label, { exact: false })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Zugang anfragen/i })).toBeVisible();
  });

  test('dashboard is protected without session', async ({ page }) => {
    await page.goto(`/b2b/dashboard?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/b2b\/login/);
    await expect(page.locator('body')).toContainText(/Partner Portal/i);
  });
});
