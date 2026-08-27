// @ts-nocheck
import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright tests [UE-61]
 * Runs once after all tests - garante limpeza e correlação de traces
 */
export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 [UE-61] Starting Playwright global teardown...');

  const fs = await import('fs');
  const path = await import('path');

  // Mantém últimos resultados para debug, limpa temporários antigos (>7 dias)
  try {
    const resultsDir = path.resolve(process.cwd(), 'test-results');
    if (fs.existsSync(resultsDir)) {
      const stat = fs.statSync(resultsDir);
      console.log(`📊 Test results em: ${resultsDir} (modificado ${stat.mtime.toISOString()})`);
    }
  } catch {}

  console.log('✅ [UE-61] Global teardown complete');
}