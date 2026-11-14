// @ts-nocheck
import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests [UE-61]
 * Runs once before all tests - garante isolamento, rastreabilidade e preparo do ambiente
 */
export default async function globalSetup(config: FullConfig) {
  console.log('🚀 [UE-61] Starting Playwright global setup...');

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const backendURL = process.env.E2E_BACKEND_URL || '';
  console.log(`📍 Base URL: ${baseURL}`);
  console.log(`🔗 Backend URL: ${backendURL || 'mock (sem backend externo)'}`);

  const fs = await import('fs');
  const path = await import('path');

  const dirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/traces',
    'test-results/custom',
    'playwright-report',
    'allure-results',
  ];

  for (const dir of dirs) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // Verifica saúde do frontend (não falha se backend ausente - modo mock)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`${baseURL}/`, { signal: controller.signal, method: 'HEAD' }).catch(() => null);
    clearTimeout(timeout);
  } catch {
    console.warn('⚠️ Frontend ainda não respondeu em globalSetup - webServer do playwright cuidará do boot');
  }

  // Prepara storageState vazio para reuso entre testes (UE-61 infra)
  const storageStatePath = path.resolve(process.cwd(), 'test-results/storageState.json');
  if (!fs.existsSync(storageStatePath)) {
    fs.writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  }

  // Escreve environment para Allure / custom reporter [UE-61]
  try {
    const envPath = path.resolve(process.cwd(), 'allure-results/environment.properties');
    const env = [
      `BaseURL=${baseURL}`,
      `BackendURL=${backendURL || 'mock'}`,
      `BrowserProjects=${config.projects.map((p) => p.name).join(',')}`,
      `Workers=${String(config.workers)}`,
      `ForbidOnly=${String(config.forbidOnly)}`,
    ].join('\n');
    fs.writeFileSync(envPath, env);
  } catch {}

  console.log('✅ [UE-61] Global setup complete');
}