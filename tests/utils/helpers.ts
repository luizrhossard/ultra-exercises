/**
 * Common test helpers and utilities
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Wait for an element to be visible and stable
 */
export async function waitForStableElement(locator: Locator, timeout = 10_000): Promise<void> {
  await expect(locator).toBeVisible({ timeout });
  // Wait for any animations to complete
  await locator.evaluate((el) => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  });
}

/**
 * Fill a form field with validation
 */
export async function fillField(locator: Locator, value: string, validate = true): Promise<void> {
  await locator.clear();
  await locator.fill(value);
  if (validate) {
    await expect(locator).toHaveValue(value);
  }
}

/**
 * Click and wait for navigation
 */
export async function clickAndWaitForNavigation(page: Page, locator: Locator, urlPattern?: string | RegExp): Promise<void> {
  const navigationPromise = urlPattern
    ? page.waitForURL(urlPattern)
    : page.waitForLoadState('networkidle');
  await locator.click();
  await navigationPromise;
}

/**
 * Select option from a select dropdown
 */
export async function selectOption(locator: Locator, value: string): Promise<void> {
  await locator.selectOption(value);
  await expect(locator).toHaveValue(value);
}

/**
 * Check if element exists without throwing
 */
export async function elementExists(locator: Locator): Promise<boolean> {
  try {
    await expect(locator).toBeVisible({ timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all text content from multiple elements
 */
export async function getAllTexts(locator: Locator): Promise<string[]> {
  const count = await locator.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await locator.nth(i).textContent();
    if (text) texts.push(text.trim());
  }
  return texts;
}

/**
 * Wait for network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take a named screenshot
 */
export async function takeNamedScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Generate random test data
 */
export function randomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

export function randomEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${randomString()}@test.example.com`;
}

export function randomName(): string {
  const adjectives = ['Swift', 'Strong', 'Fit', 'Active', 'Power', 'Iron', 'Steel'];
  const nouns = ['Athlete', 'Runner', 'Lifter', 'Trainer', 'Champion', 'Warrior'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${Date.now()}`;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError!;
}

/**
 * Custom expect matchers for common patterns
 */
export const customMatchers = {
  async toBeVisibleWithin(locator: Locator, timeout: number) {
    await expect(locator).toBeVisible({ timeout });
  },

  async toHaveTextContent(locator: Locator, expected: string | RegExp) {
    await expect(locator).toHaveText(expected);
  },

  async toHaveAttribute(locator: Locator, name: string, value?: string) {
    if (value) {
      await expect(locator).toHaveAttribute(name, value);
    } else {
      await expect(locator).toHaveAttribute(name);
    }
  },
};