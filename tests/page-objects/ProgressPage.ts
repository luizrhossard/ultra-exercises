import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProgressPage extends BasePage {
  readonly progressCharts: Locator;
  readonly historyList: Locator;
  readonly statsCards: Locator;
  readonly readinessCard: Locator;
  readonly evolutionCharts: Locator;
  readonly dateRangeSelector: Locator;
  readonly exerciseSelector: Locator;

  constructor(page: Page) {
    super(page);
    this.progressCharts = page.locator('[data-testid="progress-charts"], .progress-charts, canvas, svg');
    this.historyList = page.locator('[data-testid="history-list"], .history-list, table');
    this.statsCards = page.locator('[data-testid="stats-card"], .stats-card, .metric-card');
    this.readinessCard = page.locator('[data-testid="readiness-card"], .readiness-card');
    this.evolutionCharts = page.locator('[data-testid="evolution-chart"], .evolution-chart');
    this.dateRangeSelector = page.locator('[data-testid="date-range"], select[name="period"], button:has-text("Período")');
    this.exerciseSelector = page.locator('[data-testid="exercise-select"], select[name="exercise"]');
  }

  async selectDateRange(range: 'week' | 'month' | 'quarter' | 'year'): Promise<void> {
    await this.clickAndWait(this.dateRangeSelector);
    const option = this.page.locator(`[data-value="${range}"], option[value="${range}"]`);
    await this.clickAndWait(option);
  }

  async selectExercise(exerciseName: string): Promise<void> {
    await this.clickAndWait(this.exerciseSelector);
    const option = this.page.locator(`[data-value="${exerciseName}"], option:has-text("${exerciseName}")`);
    await this.clickAndWait(option);
  }

  async getStatsCount(): Promise<number> {
    return await this.statsCards.count();
  }

  async getReadinessScore(): Promise<string | null> {
    if (await this.isVisible(this.readinessCard)) {
      return await this.getText(this.readinessCard);
    }
    return null;
  }

  async waitForCharts(): Promise<void> {
    await this.waitForElement(this.progressCharts.first());
  }
}