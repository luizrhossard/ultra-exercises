import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FORJA|Ultra Exercises|Vite/);
  });

  test('should navigate to auth page', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h1, h2, [data-testid="auth-title"]')).toBeVisible({ timeout: 10_000 });
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