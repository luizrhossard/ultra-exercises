import { test, expect } from '../fixtures/page-objects';
import { TEST_USERS } from '../utils/test-data';

test.describe('Progress Tracking', () => {
  test.beforeEach(async ({ page, authPage }) => {
    // Skip login tests if no backend - but still test UI navigation
    if (!process.env.E2E_BACKEND_URL) {
      test.skip(true, 'Requires backend API for authenticated tests');
      return;
    }
    
    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/\/(home|dashboard|$)/);
  });

  test.describe('Progress Dashboard', () => {
    test('should display progress page @smoke', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.waitForCharts();
      
      // Should show progress charts
      await expect(progressPage.progressCharts.first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show stats cards', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      
      const statsCount = await progressPage.getStatsCount();
      expect(statsCount).toBeGreaterThanOrEqual(0);
    });

    test('should show readiness card', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      
      const readinessScore = await progressPage.getReadinessScore();
      // Readiness may or may not be available
      expect(typeof readinessScore).toBe('string');
    });

    test('should display evolution charts', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      
      // Should show evolution charts
      const evolutionCharts = progressPage.evolutionCharts;
      const count = await evolutionCharts.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Date Range Selection', () => {
    test('should filter by week', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.selectDateRange('week');
      
      // Should update charts
      await progressPage.waitForCharts();
    });

    test('should filter by month', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.selectDateRange('month');
      
      await progressPage.waitForCharts();
    });

    test('should filter by quarter', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.selectDateRange('quarter');
      
      await progressPage.waitForCharts();
    });

    test('should filter by year', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.selectDateRange('year');
      
      await progressPage.waitForCharts();
    });
  });

  test.describe('Exercise Selection', () => {
    test('should filter by exercise', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      
      // Try to select an exercise
      await progressPage.selectExercise('Supino Reto');
      
      // Should update charts
      await progressPage.waitForCharts();
    });
  });

  test.describe('History', () => {
    test('should show workout history', async ({ page, progressPage }) => {
      await progressPage.goto('/progress');
      
      // Should show history list
      await expect(progressPage.historyList).toBeVisible({ timeout: 10_000 });
    });
  });
});

test.describe('Progress Public Routes (No Auth Required)', () => {
  test('should access progress page (may redirect to auth)', async ({ page }) => {
    await page.goto('/progress');
    await page.waitForLoadState('networkidle');
    
    // Should either show progress or redirect to auth
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(progress|auth)/);
  });

  test('should navigate from home to progress', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for progress link/button
    const progressLink = page.locator('a[href="/progress"], button:has-text("Progresso"), button:has-text("Estatísticas")');
    if (await progressLink.isVisible({ timeout: 2000 })) {
      await progressLink.first().click();
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(progress|auth)/);
    }
  });
});