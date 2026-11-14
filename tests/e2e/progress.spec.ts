import { test, expect } from '../fixtures/page-objects';
import { expectAuthenticated } from '../utils/app-shell';
import { TEST_USERS } from '../utils/test-data';

/**
 * Tela de Progresso (aba "Progresso"). O app não tem filtro de semana/mês/ano nem seletor de
 * exercício: os testes cobrem os controles reais (período da tendência de prontidão).
 */
test.describe('Progress Tracking', () => {
  test.beforeEach(async ({ page, authPage }) => {
    if (!process.env.E2E_BACKEND_URL) {
      test.skip(true, 'Requires backend API for authenticated tests');
      return;
    }

    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expectAuthenticated(page);
  });

  test.describe('Progress Dashboard', () => {
    test('should display progress page @smoke', async ({ progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.waitForSections();
    });

    test('should show weekly summary and evolution sections', async ({ progressPage }) => {
      await progressPage.goto('/progress');
      await progressPage.waitForSections();
      await expect(progressPage.evolutionSection).toBeVisible({ timeout: 10_000 });
    });

    test('should show readiness card', async ({ progressPage }) => {
      await progressPage.goto('/progress');
      await expect(progressPage.readinessSummary).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Trend Period Selection', () => {
    for (const days of [7, 30, 90] as const) {
      test(`should switch readiness trend to ${days} dias`, async ({ progressPage }) => {
        await progressPage.goto('/progress');
        await progressPage.waitForSections();
        await progressPage.selectTrendPeriod(days);
      });
    }
  });

  test.describe('History', () => {
    test('should show workout history section', async ({ progressPage }) => {
      await progressPage.goto('/progress');
      await expect(progressPage.historySection).toBeVisible({ timeout: 10_000 });
    });
  });
});

test.describe('Progress Public Routes (No Auth Required)', () => {
  test('should access progress page (sem sessão mostra login)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });
  });
});
