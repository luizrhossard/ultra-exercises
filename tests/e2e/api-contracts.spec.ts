// @ts-nocheck
import { test, expect } from '@playwright/test';
import { API_ENDPOINTS } from '../utils/test-data';
import { ApiClient, validateRequiredFields } from '../utils/api-client';

/**
 * UE-62: Automacao de Teste de Contrato de API (Backend Login & Auth)
 * Valida contratos conforme docs/api/error-response-contract.md e docs/api/openapi.md
 * - Backend real quando E2E_BACKEND_URL definido, senao skip (sem falsos positivos)
 * - Correlaciona traceId body <-> header X-Trace-Id
 * - Endpoints alinhados ao backend real (treino = rotina; sem /api/auth/refresh nem CRUD de treino)
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_LOGIN = { email: 'test@ultraexercises.com', password: 'Test@123456' };

async function getAuthToken(request: any): Promise<string> {
  const loginResponse = await request.post(API_ENDPOINTS.auth.login, { data: TEST_LOGIN });
  if (!loginResponse.ok()) return '';
  const loginBody = await loginResponse.json().catch(() => ({}));
  return loginBody.token || '';
}

async function getFirstSportId(request: any, token: string): Promise<number> {
  const response = await request.get(API_ENDPOINTS.sports.list, { headers: { Authorization: `Bearer ${token}` } });
  const sports = await response.json();
  return sports[0].id;
}

function expectErrorContract(body: any, expectedStatus: number) {
  expect(body).toHaveProperty('timestamp');
  expect(body).toHaveProperty('status', expectedStatus);
  expect(body).toHaveProperty('error');
  expect(body).toHaveProperty('message');
  expect(body).toHaveProperty('traceId');
  expect(typeof body.traceId).toBe('string');
  expect(body.traceId.length).toBeGreaterThan(7);
  // timestamp ISO-8601
  expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
}

test.describe('API Contract Tests [UE-62]', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API (E2E_BACKEND_URL) - skip em modo mock para nao gerar falso positivo');
  });

  test.describe('Auth Endpoints', () => {
    test('POST /api/auth/login - should return token on valid credentials', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest.post(API_ENDPOINTS.auth.login, { data: TEST_LOGIN });
      expect(response.status()).toBe(200);
      const body = await response.json();
      validateRequiredFields(body, ['token', 'email', 'name']);
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(0);
      expect(body.email).toBe(TEST_LOGIN.email);
      await apiRequest.dispose();
    });

    test('POST /api/auth/login - should return 401 UNAUTHORIZED with error contract on invalid credentials', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest.post(API_ENDPOINTS.auth.login, {
        data: { email: 'invalid@test.com', password: 'wrongpassword' },
        headers: { 'X-Trace-Id': `e2e-62-${Date.now()}` },
      });
      expect(response.status()).toBe(401);
      const body = await response.json();
      expectErrorContract(body, 401);
      expect(body.error).toMatch(/UNAUTHORIZED|INVALID|AUTH/i);
      // header X-Trace-Id deve ecoar traceId do body (docs/api/error-response-contract.md)
      const headerTrace = response.headers()['x-trace-id'] || response.headers()['X-Trace-Id'];
      if (headerTrace) {
        expect(headerTrace).toBe(body.traceId);
      }
      await apiRequest.dispose();
    });

    test('POST /api/auth/login - should return 400 VALIDATION_ERROR on missing email', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest.post(API_ENDPOINTS.auth.login, {
        data: { password: 'Test@123456' },
      });
      expect([400, 422]).toContain(response.status());
      const body = await response.json().catch(() => ({}));
      if (body && body.status) {
        expect([400, 422]).toContain(body.status);
        if (body.error) expect(body.error).toMatch(/VALIDATION_ERROR|BAD_REQUEST/i);
      }
      await apiRequest.dispose();
    });

    test('POST /api/auth/register - should create new user', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2,6)}@test.example.com`;
      const response = await apiRequest.post(API_ENDPOINTS.auth.register, {
        data: { email: uniqueEmail, password: 'Test@123456', name: 'Test User' },
      });
      expect([200, 201]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('email', uniqueEmail);
      await apiRequest.dispose();
    });

    test('POST /api/auth/register - should return 409 on duplicate email', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const dupEmail = `dup-${Date.now()}@test.example.com`;
      await apiRequest.post(API_ENDPOINTS.auth.register, {
        data: { email: dupEmail, password: 'Test@123456', name: 'Dup User' },
      });
      const response = await apiRequest.post(API_ENDPOINTS.auth.register, {
        data: { email: dupEmail, password: 'Test@123456', name: 'Dup User 2' },
      });
      expect(response.status()).toBe(409);
      await apiRequest.dispose();
    });

    test('GET /api/me - should return user profile with valid token', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const token = await getAuthToken(apiRequest);
      test.skip(!token, 'sem token - backend seed ausente');
      const response = await apiRequest.get(API_ENDPOINTS.auth.me, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('name');
      await apiRequest.dispose();
    });

    test('GET /api/me - should return 401 UNAUTHORIZED without token com contrato', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest.get(API_ENDPOINTS.auth.me);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expectErrorContract(body, 401);
      await apiRequest.dispose();
    });
  });

  // Treino = rotina no backend. Não há CRUD de treino: a rotina é gerada por esporte e removida por id.
  test.describe('Workout (Routine) Endpoints', () => {
    test('GET /api/routines - should return routine list', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const token = await getAuthToken(apiRequest);
      test.skip(!token, 'sem token');
      const response = await apiRequest.get(API_ENDPOINTS.workouts.list, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      await apiRequest.dispose();
    });

    test('POST /api/routines/generate - should generate routine for a sport', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const token = await getAuthToken(apiRequest);
      test.skip(!token, 'sem token');
      const sportId = await getFirstSportId(apiRequest, token);
      const response = await apiRequest.post(API_ENDPOINTS.workouts.create, {
        headers: { Authorization: `Bearer ${token}` },
        data: { sportId },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toContain('Treino');
      expect(Array.isArray(body.items)).toBe(true);
      await apiRequest.dispose();
    });

    test('DELETE /api/routines/:id - should delete routine e remover da lista', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const token = await getAuthToken(apiRequest);
      test.skip(!token, 'sem token');
      const headers = { Authorization: `Bearer ${token}` };
      const sportId = await getFirstSportId(apiRequest, token);
      const created = await (await apiRequest.post(API_ENDPOINTS.workouts.create, { headers, data: { sportId } })).json();
      const response = await apiRequest.delete(API_ENDPOINTS.workouts.delete(created.id), { headers });
      expect([200, 204]).toContain(response.status());
      const list = await (await apiRequest.get(API_ENDPOINTS.workouts.list, { headers })).json();
      expect(list.map((r: any) => r.id)).not.toContain(created.id);
      await apiRequest.dispose();
    });
  });

  test.describe('Error Response Format [UE-25 contrato]', () => {
    test('should return consistent error format com traceId', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const traceId = `e2e-62-${Date.now()}`;
      const response = await apiRequest.post(API_ENDPOINTS.auth.login, {
        data: { email: 'invalid@test.com', password: 'wrongpassword' },
        headers: { 'X-Trace-Id': traceId },
      });
      expect(response.status()).toBe(401);
      const body = await response.json();
      expectErrorContract(body, 401);
      // Se cliente enviou X-Trace-Id valido, deve ser ecoado
      const headerTrace = response.headers()['x-trace-id'];
      if (headerTrace) expect(headerTrace.length).toBeGreaterThan(7);
      await apiRequest.dispose();
    });

    test('should use ApiClient para validar contrato', async ({ playwright }) => {
      const request = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const client = new ApiClient({ request, baseURL: BACKEND_URL });
      const response = await client.post(API_ENDPOINTS.auth.login, { email: 'invalid@test.com', password: 'wrong' });
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('message');
      expect(typeof body.message).toBe('string');
      await request.dispose();
    });
  });

  test.describe('CORS & Security Headers', () => {
    test('should include CORS headers em OPTIONS', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest
        .fetch(API_ENDPOINTS.auth.login, {
          method: 'OPTIONS',
          headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' },
        })
        .catch(() => null);
      if (!response) test.skip(true, 'OPTIONS nao suportado neste backend');
      expect([200, 204]).toContain(response!.status());
      const headers = response!.headers();
      // Access-Control-Allow-Origin pode ser * ou url especifica
      expect(headers['access-control-allow-origin'] || headers['access-control-allow-methods']).toBeDefined();
      await apiRequest.dispose();
    });

    test('should include security headers', async ({ playwright }) => {
      const apiRequest = await playwright.request.newContext({ baseURL: BACKEND_URL });
      const response = await apiRequest.get(API_ENDPOINTS.auth.me);
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      await apiRequest.dispose();
    });
  });
});
