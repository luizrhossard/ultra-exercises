import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  }

  async goto(path: string = ''): Promise<void> {
    await this.page.goto(`${this.baseURL}${path}`);
    await this.page.waitForLoadState('networkidle');
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