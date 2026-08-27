import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');

  // Cleanup test data if needed
  // This would typically call API endpoints to clean up test users, workouts, etc.

  console.log('✅ Global teardown complete');
}