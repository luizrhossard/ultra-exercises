import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** Períodos oferecidos pela tendência de prontidão (src/screens/Progress.tsx: TREND_OPTIONS). */
export type TrendPeriod = 7 | 30 | 90;

/** Tela de Progresso (aba "Progresso"): resumo semanal, tendência de prontidão, evolução e histórico. */
export class ProgressPage extends BasePage {
  readonly trendPeriodGroup: Locator;
  readonly readinessSummary: Locator;
  readonly weeklySummarySection: Locator;
  readonly evolutionSection: Locator;
  readonly historySection: Locator;

  constructor(page: Page) {
    super(page);
    this.trendPeriodGroup = page.getByRole('group', { name: 'Período da tendência' });
    // Card de prontidão = seção com o seletor de período e o resumo/tendência.
    this.readinessSummary = page.getByText('Prontidão · tendência', { exact: true });
    this.weeklySummarySection = page.getByText('Semana atual · resumo', { exact: true });
    this.evolutionSection = page.getByText('Evolução · dashboard', { exact: true });
    this.historySection = page.getByText('Histórico de treinos', { exact: true });
  }

  /** Muda o período da tendência de prontidão (botões "7 dias", "30 dias", "90 dias"). */
  async selectTrendPeriod(days: TrendPeriod): Promise<void> {
    const button = this.trendPeriodGroup.getByRole('button', { name: `${days} dias` });
    await this.clickAndWait(button);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  async waitForSections(): Promise<void> {
    await expect(this.weeklySummarySection).toBeVisible({ timeout: 10_000 });
    await expect(this.trendPeriodGroup).toBeVisible({ timeout: 10_000 });
  }
}
