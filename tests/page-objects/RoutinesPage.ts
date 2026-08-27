import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class RoutinesPage extends BasePage {
  readonly createRoutineButton: Locator;
  readonly routineList: Locator;
  readonly routineCards: Locator;
  readonly searchInput: Locator;
  readonly filterButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.createRoutineButton = page.locator('[data-testid="create-routine"], button:has-text("Nova Rotina"), button:has-text("Criar Treino")');
    this.routineList = page.locator('[data-testid="routine-list"], .routine-list, main');
    this.routineCards = page.locator('[data-testid="routine-card"], .routine-card, article:has-text("Treino")');
    this.searchInput = page.locator('[data-testid="search-routines"], input[placeholder*="buscar" i], input[placeholder*="search" i]');
    this.filterButtons = page.locator('[data-testid="filter-routines"], button:has-text("Filtrar")');
  }

  async createRoutine(name: string, description?: string): Promise<void> {
    await this.clickAndWait(this.createRoutineButton);
    // Fill routine form - implementation depends on actual UI
    const nameInput = this.page.locator('[data-testid="routine-name"], input[name="name"]');
    await this.waitForElement(nameInput);
    await nameInput.fill(name);
    if (description) {
      const descInput = this.page.locator('[data-testid="routine-description"], textarea[name="description"]');
      await descInput.fill(description);
    }
    const submitButton = this.page.locator('[data-testid="save-routine"], button[type="submit"]:has-text("Salvar")');
    await this.clickAndWait(submitButton);
  }

  async getRoutineCount(): Promise<number> {
    return await this.routineCards.count();
  }

  async openRoutine(index: number): Promise<void> {
    const card = this.routineCards.nth(index);
    await this.clickAndWait(card);
  }

  async searchRoutines(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForLoadState('networkidle');
  }
}