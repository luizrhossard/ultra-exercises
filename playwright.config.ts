import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright configuration for Ultra Exercises E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['github'], // GitHub Actions annotation reporter
    ['allure-playwright', { outputFolder: 'allure-results' }], // Allure reporter
    ['./tests/reporters/custom-reporter.ts', { outputDir: 'test-results/custom' }], // Custom reporter
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Global test timeout */
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  /* Configure projects for major browsers */
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Branded browsers (require installation)
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Mobile Chrome Landscape',
      use: { ...devices['Pixel 5'], viewport: { width: 896, height: 412 } },
    },
    {
      name: 'Mobile Safari Landscape',
      use: { ...devices['iPhone 12'], viewport: { width: 896, height: 412 } },
    },

    // Tablet viewports
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'Galaxy Tab S4',
      use: { ...devices['Galaxy Tab S4'] },
    },

    // High DPI / Retina
    {
      name: 'Chromium HiDPI',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 },
    },
    {
      name: 'Firefox HiDPI',
      use: { ...devices['Desktop Firefox'], deviceScaleFactor: 2 },
    },

    // Reduced motion / accessibility
    {
      name: 'Chromium Reduced Motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
    {
      name: 'Chromium High Contrast',
      use: { ...devices['Desktop Chrome'], forcedColors: 'active' },
    },

    // Slow network / offline simulation
    {
      name: 'Chromium Slow 3G',
      use: { ...devices['Desktop Chrome'], offline: false },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Global setup and teardown */
  globalSetup: resolve(__dirname, './tests/global-setup.ts'),
  globalTeardown: resolve(__dirname, './tests/global-teardown.ts'),

  /* Global test timeout */
  timeout: 60_000,

  /* Expect timeout */
  expect: {
    timeout: 10_000,
  },

  /* Output directories */
  outputDir: 'test-results/',
});