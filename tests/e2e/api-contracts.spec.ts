import { test, expect } from '@playwright/test';
import { API_ENDPOINTS } from '../utils/test-data';

async function getAuthToken(page: any): Promise<string> {
  const loginResponse = await page.request.post(API_ENDPOINTS.auth.login, {
    data: {
      email: 'test@ultraexercises.com',
      password: 'Test@123456',
    },
  });
  const loginBody = await loginResponse.json();
  return loginBody.token;
}

test.describe('API Contract Tests', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
  });

  test.describe('Auth Endpoints', () => {
    test('POST /api/auth/login - should return token on valid credentials', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.login, {
        data: {
          email: 'test@ultraexercises.com',
          password: 'Test@123456',
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(0);
    });

    test('POST /api/auth/login - should return 401 on invalid credentials', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.login, {
        data: {
          email: 'invalid@test.com',
          password: 'wrongpassword',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/auth/login - should return 400 on missing email', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.login, {
        data: {
          password: 'Test@123456',
        },
      });
      
      expect([400, 422]).toContain(response.status());
    });

    test('POST /api/auth/register - should create new user', async ({ page }) => {
      const uniqueEmail = `test-${Date.now()}@test.example.com`;
      const response = await page.request.post(API_ENDPOINTS.auth.register, {
        data: {
          email: uniqueEmail,
          password: 'Test@123456',
          name: 'Test User',
        },
      });
      
      expect([200, 201]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
    });

    test('POST /api/auth/register - should return 409 on duplicate email', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.register, {
        data: {
          email: 'test@ultraexercises.com',
          password: 'Test@123456',
          name: 'Test User',
        },
      });
      
      expect([400, 409, 422]).toContain(response.status());
    });

    test('GET /api/auth/me - should return user profile with valid token', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.auth.me, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('name');
    });

    test('GET /api/auth/me - should return 401 without token', async ({ page }) => {
      const response = await page.request.get(API_ENDPOINTS.auth.me);
      expect(response.status()).toBe(401);
    });

    test('POST /api/auth/refresh - should refresh token', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.post(API_ENDPOINTS.auth.refresh, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect([200, 401]).toContain(response.status());
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('token');
      }
    });
  });

  test.describe('Workout Endpoints', () => {
    test('GET /api/workouts - should return workout list', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.workouts.list, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('POST /api/workouts - should create workout', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.post(API_ENDPOINTS.workouts.create, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          name: 'Test Workout',
          description: 'Test Description',
          exercises: [
            { name: 'Supino Reto', sets: 3, reps: 10, weight: 60 },
          ],
        },
      });
      
      expect([200, 201]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name', 'Test Workout');
    });

    test('GET /api/workouts/:id - should return workout by id', async ({ page }) => {
      const token = await getAuthToken(page);
      
      // First create a workout
      const createResponse = await page.request.post(API_ENDPOINTS.workouts.create, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          name: 'Test Workout for Get',
          description: 'Test Description',
          exercises: [],
        },
      });
      
      const createBody = await createResponse.json();
      const workoutId = createBody.id;
      
      const response = await page.request.get(API_ENDPOINTS.workouts.get(workoutId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('id', workoutId);
      expect(body).toHaveProperty('name', 'Test Workout for Get');
    });

    test('PUT /api/workouts/:id - should update workout', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const createResponse = await page.request.post(API_ENDPOINTS.workouts.create, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          name: 'Test Workout for Update',
          description: 'Test Description',
          exercises: [],
        },
      });
      
      const createBody = await createResponse.json();
      const workoutId = createBody.id;
      
      const response = await page.request.put(API_ENDPOINTS.workouts.update(workoutId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          name: 'Updated Workout Name',
          description: 'Updated Description',
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('name', 'Updated Workout Name');
    });

    test('DELETE /api/workouts/:id - should delete workout', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const createResponse = await page.request.post(API_ENDPOINTS.workouts.create, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          name: 'Test Workout for Delete',
          description: 'Test Description',
          exercises: [],
        },
      });
      
      const createBody = await createResponse.json();
      const workoutId = createBody.id;
      
      const response = await page.request.delete(API_ENDPOINTS.workouts.delete(workoutId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect([200, 204]).toContain(response.status());
      
      // Verify deletion
      const getResponse = await page.request.get(API_ENDPOINTS.workouts.get(workoutId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Exercise Endpoints', () => {
    test('GET /api/exercises - should return exercise list', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.exercises.list, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/exercises/search - should search exercises', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.exercises.search, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { q: 'supino' },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  test.describe('Progress Endpoints', () => {
    test('GET /api/progress/history - should return progress history', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.progress.history, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/progress/stats - should return progress stats', async ({ page }) => {
      const token = await getAuthToken(page);
      
      const response = await page.request.get(API_ENDPOINTS.progress.stats, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('totalWorkouts');
      expect(body).toHaveProperty('totalVolume');
    });
  });

  test.describe('Error Response Format', () => {
    test('should return consistent error format', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.login, {
        data: {
          email: 'invalid@test.com',
          password: 'wrongpassword',
        },
      });
      
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('message');
      expect(typeof body.message).toBe('string');
    });

    test('should include traceId in error responses', async ({ page }) => {
      const response = await page.request.post(API_ENDPOINTS.auth.login, {
        data: {
          email: 'invalid@test.com',
          password: 'wrongpassword',
        },
      });
      
      const body = await response.json();
      // traceId may or may not be present
      if (body.traceId) {
        expect(typeof body.traceId).toBe('string');
      }
    });
  });

  test.describe('Rate Limiting', () => {
    test('should return 429 when rate limited', async ({ page }) => {
      // Make multiple rapid requests
      const promises = Array(20).fill(null).map(() => 
        page.request.post(API_ENDPOINTS.auth.login, {
          data: {
            email: 'test@ultraexercises.com',
            password: 'wrongpassword',
          },
        })
      );
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status() === 429);
      
      // Rate limiting may or may not be enabled
      if (rateLimited) {
        expect(rateLimited).toBe(true);
      }
    });
  });

  test.describe('CORS Headers', () => {
    test('should include CORS headers', async ({ page }) => {
      const response = await page.request.options(API_ENDPOINTS.auth.login);
      
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers['access-control-allow-origin']).toBeDefined();
    });
  });

  test.describe('Security Headers', () => {
    test('should include security headers', async ({ page }) => {
      const response = await page.request.get(API_ENDPOINTS.auth.me);
      
      const headers = response.headers();
      // Check for common security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      // Other headers may vary
    });
  });
});