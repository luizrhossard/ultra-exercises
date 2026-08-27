import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
export default async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');

  // Verify the dev server is running
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  console.log(`📍 Base URL: ${baseURL}`);

  // Create test results directories
  const fs = await import('fs');
  const path = await import('path');

  const dirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/traces',
    'playwright-report',
  ];

  for (const dir of dirs) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  console.log('✅ Global setup complete');
}