import { Page, Locator, expect } from '@playwright/test';
import { TAB_BY_PATH, tabButton } from '../utils/app-shell';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Navega para uma tela do app. O frontend não tem rotas por URL: caminhos conhecidos
   * (ex.: '/routines') abrem a raiz e clicam na aba correspondente. Ver app-shell.ts.
   */
  async goto(path: string = ''): Promise<void> {
    const tab = TAB_BY_PATH[path];
    // SPA sem rotas: caminhos conhecidos abrem a raiz e clicam na aba; '/auth' também é a raiz (gate de login).
    const target = tab ? '/' : path === '/auth' ? '/' : path;
    await this.page.goto(`${this.baseURL}${target}`);
    await this.page.waitForLoadState('networkidle');
    if (tab) {
      // A sidebar monta após o carregamento do perfil: espera o botão em vez de pular o clique.
      const button = tabButton(this.page, tab);
      await expect(button).toBeVisible({ timeout: 15_000 });
      await button.click();
      await this.page.waitForLoadState('networkidle');
    }
  }

  async waitForElement(locator: Locator, timeout = 10_000): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
  }

  async clickAndWait(locator: Locator, options?: { timeout?: number }): Promise<void> {
    await locator.click({ timeout: options?.timeout || 10_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async fillAndSubmit(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
    await locator.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async getText(locator: Locator): Promise<string> {
    return (await locator.textContent()) || '';
  }

  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}