import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { tabButton } from '../utils/app-shell';

/**
 * Tela de Rotinas: "Treino do dia" (escolha do esporte + gerar) e "Prescritas"
 * (cartões de rotina; ao expandir, "Iniciar sessão" abre o sheet de execução).
 * Ver src/screens/Routines.tsx.
 */
export class RoutinesPage extends BasePage {
  readonly generator: Locator;
  readonly generateButton: Locator;
  readonly routineList: Locator;
  readonly emptyState: Locator;
  readonly sessionSheet: Locator;

  constructor(page: Page) {
    super(page);
    this.generator = page.getByRole('heading', { name: 'Treino do dia' });
    this.generateButton = page.getByRole('button', { name: /^Gerar para/ });
    this.routineList = page.getByRole('heading', { name: 'Prescritas' });
    this.emptyState = page.getByText('Gere sua primeira rotina acima.');
    this.sessionSheet = page.getByRole('dialog');
  }

  async gotoRoutinesTab(): Promise<void> {
    const tab = tabButton(this.page, 'Rotinas');
    await expect(tab).toBeVisible({ timeout: 15_000 });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(this.generator).toBeVisible({ timeout: 15_000 });
    // Lista pode estar em skeleton ("Carregando rotinas"): espera resolver antes de contar.
    await expect(this.page.getByLabel('Carregando rotinas')).toBeHidden({ timeout: 15_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /** Gera a rotina do esporte foco e espera o toast de confirmação. */
  async generateRoutine(sportName?: string): Promise<void> {
    if (sportName) {
      const sportButton = this.page.getByRole('button', { name: sportName, exact: true });
      await expect(sportButton).toBeVisible({ timeout: 10_000 });
      await sportButton.click();
    }
    await expect(this.generateButton).toBeEnabled({ timeout: 10_000 });
    await this.generateButton.scrollIntoViewIfNeeded();
    await this.generateButton.click();
    // Os toasts do app não têm role; localiza pelo texto da mensagem.
    await expect(this.page.getByText(/criado\./)).toBeVisible({ timeout: 20_000 });
    // Novo cartão entra na lista após refresh do cache.
    await expect(this.page.locator('h3').filter({ hasText: 'Treino' }).first()).toBeVisible({ timeout: 15_000 });
  }

  /** Abre o primeiro cartão de rotina da lista de prescritas (idempotente). */
  async openFirstRoutine(): Promise<void> {
    const startButton = this.page.getByRole('button', { name: 'Iniciar sessão' }).first();
    // Já expandido (ex.: após generateRoutine que mantém estado)? Não clica de novo — toggle fecharia.
    if (await startButton.isVisible().catch(() => false)) return;

    const card = this.page.locator('h3').filter({ hasText: 'Treino' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(startButton).toBeVisible({ timeout: 10_000 });
  }

  /** Inicia a sessão da rotina expandida (robusto contra re-render/detach). */
  async startSession(): Promise<void> {
    const startButton = this.page.getByRole('button', { name: 'Iniciar sessão' }).first();
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await startButton.scrollIntoViewIfNeeded();
    // O card faz re-render ao expandir (detach do DOM): tenta clique normal, cai para force.
    try {
      await startButton.click({ timeout: 10_000 });
    } catch {
      await startButton.click({ timeout: 10_000, force: true });
    }
    // Sheet de execução tem título "Executando · <esporte>" — mais específico que role=dialog genérico.
    const sessionDialog = this.page.getByRole('dialog').filter({ hasText: /Executando/ });
    await expect(sessionDialog).toBeVisible({ timeout: 15_000 });
    await expect(this.sessionSheet).toBeVisible({ timeout: 15_000 });
  }

  async getRoutineCount(): Promise<number> {
    return this.page.locator('h3').filter({ hasText: 'Treino' }).count();
  }

  async searchRoutines(_query: string): Promise<void> {
    // A tela não tem busca textual: kept por compatibilidade com o spec anterior.
  }
}
