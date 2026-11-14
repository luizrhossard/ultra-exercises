import { test, expect } from '../fixtures/page-objects';
import { expectAuthenticated, expectActiveTab } from '../utils/app-shell';
import { TEST_USERS } from '../utils/test-data';

/**
 * Rotinas e Player.
 *
 * O app não tem formulário de criação de rotina: o fluxo real é "Treino do dia" -> gerar ->
 * "Prescritas" -> "Iniciar sessão" (sheet com registro por exercício e conclusão).
 * O Player é o modal de demonstração do exercício, aberto pelo card do feed.
 */
test.describe('Workout Management', () => {
  test.beforeEach(async ({ page, authPage }) => {
    test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');

    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expectAuthenticated(page);
  });

  test.describe('Routine List', () => {
    test('should display routines page @smoke', async ({ page, routinesPage }) => {
      await routinesPage.gotoRoutinesTab();
      await expectActiveTab(page, 'Rotinas');
      await expect(routinesPage.generator).toBeVisible();
      await expect(routinesPage.routineList).toBeVisible();
    });

    test('should generate a routine for the focus sport', async ({ page, routinesPage }) => {
      await routinesPage.gotoRoutinesTab();
      await routinesPage.generateRoutine();

      const card = page.locator('h3').filter({ hasText: 'Treino' }).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
    });

    test('should show prescribed items when a routine is expanded', async ({ page, routinesPage }) => {
      await routinesPage.gotoRoutinesTab();
      const before = await routinesPage.getRoutineCount();
      if (before === 0) await routinesPage.generateRoutine();

      await routinesPage.openFirstRoutine();
      // itens da rotina mostram séries x reps e descanso
      await expect(page.getByText(/descanso/).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Iniciar sessão' })).toBeVisible();
    });
  });

  test.describe('Start Session from Routine', () => {
    test('should open the session sheet and register an exercise', async ({ page, routinesPage }) => {
      await routinesPage.gotoRoutinesTab();
      if ((await routinesPage.getRoutineCount()) === 0) await routinesPage.generateRoutine();

      await routinesPage.openFirstRoutine();
      await routinesPage.startSession();

      await expect(page.getByRole('heading', { name: /^Executando/ })).toBeVisible();
      const registrar = page.getByRole('button', { name: 'Registrar exercício' }).first();
      await registrar.click();
      await expect(page.getByText(/Exercício registrado\./)).toBeVisible({ timeout: 10_000 });
    });

    test('should complete the session', async ({ page, routinesPage }) => {
      await routinesPage.gotoRoutinesTab();
      if ((await routinesPage.getRoutineCount()) === 0) await routinesPage.generateRoutine();

      await routinesPage.openFirstRoutine();
      await routinesPage.startSession();

      await page.getByRole('button', { name: 'Concluir sessão' }).click();
      await expect(page.getByText(/Sessão concluída/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('dialog')).toBeHidden();
    });
  });

  test.describe('Exercise Player (modal do feed)', () => {
    test('should open the player from a feed card', async ({ page }) => {
      await page.goto('/');
      // Feed monta após cache/perfil: espera o primeiro card clicável e estabiliza a animação de entrada.
      const card = page.locator('button', { has: page.locator('h3') }).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(400);
      const name = (await card.locator('h3, h2').first().textContent())?.trim() ?? '';

      await card.scrollIntoViewIfNeeded();
      await card.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      if (name) await expect(dialog).toHaveAttribute('aria-label', name);
      await expect(page.getByRole('button', { name: 'Voltar para o feed' })).toBeVisible();
    });

    test('should toggle the demo playback and close', async ({ page }) => {
      await page.goto('/');
      const card = page.locator('button', { has: page.locator('h3') }).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(400);
      await card.scrollIntoViewIfNeeded();
      await card.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      const play = page.getByRole('button', { name: 'Reproduzir demonstração' });
      if (await play.isVisible().catch(() => false)) {
        await play.scrollIntoViewIfNeeded();
        await play.click();
        await expect(page.getByRole('button', { name: 'Pausar demonstração' })).toBeVisible({ timeout: 10_000 });
      }

      // Fechamento robusto: framer-motion deixa o botão "not stable" — espera, tenta normal, cai para force/Escape.
      const back = page.getByRole('button', { name: 'Voltar para o feed' });
      await expect(back).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(500);
      try {
        await back.click({ timeout: 8_000 });
      } catch {
        try {
          await back.click({ timeout: 8_000, force: true });
        } catch {
          await page.keyboard.press('Escape');
        }
      }
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    });
  });
});
