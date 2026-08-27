/**
 * Test data management for E2E tests
 * Provides consistent test users and data across test runs
 */

export interface TestUser {
  email: string;
  password: string;
  name: string;
  has2FA?: boolean;
  totpSecret?: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  standard: {
    email: 'test@ultraexercises.com',
    password: 'Test@123456',
    name: 'Test User',
  },
  admin: {
    email: 'admin@ultraexercises.com',
    password: 'Admin@123456',
    name: 'Admin User',
  },
  with2FA: {
    email: '2fa@ultraexercises.com',
    password: 'Test@123456',
    name: '2FA User',
    has2FA: true,
    totpSecret: 'JBSWY3DPEHPK3PXP', // Test secret for TOTP
  },
};

/**
 * Generate a unique test user for isolated test runs
 */
export function generateTestUser(prefix = 'e2e'): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `${prefix}-${timestamp}-${random}@test.ultraexercises.com`,
    password: 'Test@123456',
    name: `E2E Test User ${timestamp}`,
  };
}

/**
 * Test workout data
 */
export const TEST_WORKOUTS = {
  basic: {
    name: 'Treino Teste Básico',
    description: 'Treino criado para testes E2E',
    exercises: [
      { name: 'Supino Reto', sets: 3, reps: 10, weight: 60 },
      { name: 'Agachamento Livre', sets: 4, reps: 8, weight: 80 },
    ],
  },
  advanced: {
    name: 'Treino Avançado Teste',
    description: 'Treino avançado para testes de regressão',
    exercises: [
      { name: 'Levantamento Terra', sets: 5, reps: 5, weight: 120 },
      { name: 'Desenvolvimento Militar', sets: 4, reps: 8, weight: 50 },
      { name: 'Barra Fixa', sets: 3, reps: 10, weight: 0 },
    ],
  },
};

/**
 * API endpoints for test data setup/teardown
 */
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
  },
  workouts: {
    list: '/api/workouts',
    create: '/api/workouts',
    get: (id: string) => `/api/workouts/${id}`,
    update: (id: string) => `/api/workouts/${id}`,
    delete: (id: string) => `/api/workouts/${id}`,
  },
  exercises: {
    list: '/api/exercises',
    search: '/api/exercises/search',
  },
  progress: {
    history: '/api/progress/history',
    stats: '/api/progress/stats',
  },
};

/**
 * Helper to create test data via API
 */
export async function createTestUser(page: any, user: TestUser): Promise<void> {
  const response = await page.request.post(API_ENDPOINTS.auth.register, {
    data: {
      email: user.email,
      password: user.password,
      name: user.name,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create test user: ${response.statusText()}`);
  }
}

/**
 * Helper to clean up test data via API
 */
export async function cleanupTestUser(page: any, email: string): Promise<void> {
  // Implementation would depend on API capabilities
  // This is a placeholder for when backend supports user deletion
  console.log(`Cleanup test user: ${email}`);
}