// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests [UE-63] @smoke', () => {
  test('should load the application @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FORJA|Ultra Exercises|Vite/);
    // rastreabilidade visual: screenshot basica em smoke
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to auth page @smoke', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h1, h2, [data-testid="auth-title"]')).toBeVisible({ timeout: 10_000 });
    // valida que form de auth renderiza (sem depender de backend)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should navigate to critical journeys without backend @smoke', async ({ page }) => {
    // garante que rotas criticas existem mesmo sem backend (redirecionam para /auth)
    for (const route of ['/routines', '/progress', '/player']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toMatch(/\/(routines|progress|player|auth)/);
    }
  });
});

test.describe('Basic Navigation', () => {
  test('should have working navigation', async ({ page }) => {
    await page.goto('/');
    // Basic check that the app loads without console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForLoadState('networkidle');
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});