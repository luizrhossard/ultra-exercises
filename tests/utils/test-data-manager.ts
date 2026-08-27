/**
 * Test Data Management Utilities
 * Provides seeding, cleanup, and isolated test data management
 */

import { APIRequestContext } from '@playwright/test';
import { API_ENDPOINTS, TEST_USERS, TEST_WORKOUTS, generateTestUser } from './test-data';

export interface TestDataManagerOptions {
  request: APIRequestContext;
  baseURL: string;
  authToken?: string;
}

export class TestDataManager {
  private request: APIRequestContext;
  private baseURL: string;
  private authToken?: string;
  private createdUsers: string[] = [];
  private createdWorkouts: string[] = [];

  constructor(options: TestDataManagerOptions) {
    this.request = options.request;
    this.baseURL = options.baseURL;
    this.authToken = options.authToken;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  // ============ User Management ============

  async createTestUser(userData?: Partial<{ email: string; password: string; name: string }>): Promise<{ email: string; password: string; name: string; token: string }> {
    const user = userData || generateTestUser('managed');
    
    const response = await this.request.post(`${this.baseURL}${API_ENDPOINTS.auth.register}`, {
      headers: this.getHeaders(),
      data: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create test user: ${response.statusText()}`);
    }

    const body = await response.json();
    this.createdUsers.push(user.email);
    
    return {
      email: user.email,
      password: user.password,
      name: user.name,
      token: body.token,
    };
  }

  async createMultipleTestUsers(count: number): Promise<Array<{ email: string; password: string; name: string; token: string }>> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser();
      users.push(user);
    }
    return users;
  }

  async loginUser(email: string, password: string): Promise<string> {
    const response = await this.request.post(`${this.baseURL}${API_ENDPOINTS.auth.login}`, {
      headers: this.getHeaders(),
      data: { email, password },
    });

    if (!response.ok()) {
      throw new Error(`Failed to login: ${response.statusText()}`);
    }

    const body = await response.json();
    return body.token;
  }

  async deleteTestUser(email: string): Promise<void> {
    // Note: This requires a delete user endpoint which may not exist
    // This is a placeholder for when the backend supports user deletion
    console.log(`Would delete test user: ${email}`);
    this.createdUsers = this.createdUsers.filter(e => e !== email);
  }

  async cleanupAllUsers(): Promise<void> {
    for (const email of this.createdUsers) {
      await this.deleteTestUser(email);
    }
    this.createdUsers = [];
  }

  // ============ Workout Management ============

  async createTestWorkout(workoutData?: Partial<{ name: string; description: string; exercises: any[] }>): Promise<any> {
    const workout = workoutData || TEST_WORKOUTS.basic;
    
    const response = await this.request.post(`${this.baseURL}${API_ENDPOINTS.workouts.create}`, {
      headers: this.getHeaders(),
      data: workout,
    });

    if (!response.ok()) {
      throw new Error(`Failed to create test workout: ${response.statusText()}`);
    }

    const body = await response.json();
    this.createdWorkouts.push(body.id);
    
    return body;
  }

  async createMultipleTestWorkouts(count: number): Promise<any[]> {
    const workouts = [];
    for (let i = 0; i < count; i++) {
      const workout = await this.createTestWorkout({
        name: `${TEST_WORKOUTS.basic.name} ${i + 1}`,
        description: `${TEST_WORKOUTS.basic.description} ${i + 1}`,
      });
      workouts.push(workout);
    }
    return workouts;
  }

  async getTestWorkout(id: string): Promise<any> {
    const response = await this.request.get(`${this.baseURL}${API_ENDPOINTS.workouts.get(id)}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Failed to get workout: ${response.statusText()}`);
    }

    return response.json();
  }

  async updateTestWorkout(id: string, data: any): Promise<any> {
    const response = await this.request.put(`${this.baseURL}${API_ENDPOINTS.workouts.update(id)}`, {
      headers: this.getHeaders(),
      data,
    });

    if (!response.ok()) {
      throw new Error(`Failed to update workout: ${response.statusText()}`);
    }

    return response.json();
  }

  async deleteTestWorkout(id: string): Promise<void> {
    const response = await this.request.delete(`${this.baseURL}${API_ENDPOINTS.workouts.delete(id)}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok() && response.status() !== 404) {
      throw new Error(`Failed to delete workout: ${response.statusText()}`);
    }

    this.createdWorkouts = this.createdWorkouts.filter(w => w !== id);
  }

  async cleanupAllWorkouts(): Promise<void> {
    for (const id of this.createdWorkouts) {
      await this.deleteTestWorkout(id);
    }
    this.createdWorkouts = [];
  }

  // ============ Exercise Management ============

  async searchExercises(query: string): Promise<any[]> {
    const response = await this.request.get(`${this.baseURL}${API_ENDPOINTS.exercises.search}`, {
      headers: this.getHeaders(),
      params: { q: query },
    });

    if (!response.ok()) {
      throw new Error(`Failed to search exercises: ${response.statusText()}`);
    }

    return response.json();
  }

  // ============ Progress Management ============

  async getProgressHistory(): Promise<any[]> {
    const response = await this.request.get(`${this.baseURL}${API_ENDPOINTS.progress.history}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Failed to get progress history: ${response.statusText()}`);
    }

    return response.json();
  }

  async getProgressStats(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}${API_ENDPOINTS.progress.stats}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Failed to get progress stats: ${response.statusText()}`);
    }

    return response.json();
  }

  // ============ Cleanup ============

  async cleanupAll(): Promise<void> {
    await this.cleanupAllWorkouts();
    await this.cleanupAllUsers();
  }

  getCreatedUsers(): string[] {
    return [...this.createdUsers];
  }

  getCreatedWorkouts(): string[] {
    return [...this.createdWorkouts];
  }
}

/**
 * Fixture for test data management
 */
export async function createTestDataManager(request: APIRequestContext, baseURL: string): Promise<TestDataManager> {
  return new TestDataManager({ request, baseURL });
}

/**
 * Pre-seeded test data for common scenarios
 */
export const SEEDED_TEST_DATA = {
  // Standard test user (pre-created in test DB)
  standardUser: TEST_USERS.standard,
  
  // Admin test user
  adminUser: TEST_USERS.admin,
  
  // User with 2FA enabled
  userWith2FA: TEST_USERS.with2FA,
  
  // Basic workout template
  basicWorkout: TEST_WORKOUTS.basic,
  
  // Advanced workout template
  advancedWorkout: TEST_WORKOUTS.advanced,
};

/**
 * Generate isolated test data for parallel test execution
 */
export function generateIsolatedTestData(prefix: string = 'parallel') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const uniqueId = `${prefix}-${timestamp}-${random}`;
  
  return {
    user: {
      email: `${uniqueId}@test.ultraexercises.com`,
      password: 'Test@123456',
      name: `Parallel Test User ${uniqueId}`,
    },
    workout: {
      name: `Parallel Workout ${uniqueId}`,
      description: `Workout for parallel test ${uniqueId}`,
      exercises: [
        { name: 'Supino Reto', sets: 3, reps: 10, weight: 60 },
        { name: 'Agachamento Livre', sets: 4, reps: 8, weight: 80 },
      ],
    },
  };
}

/**
 * Test data factory for creating consistent test scenarios
 */
export class TestDataFactory {
  static createUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
    return {
      email: overrides.email || generateTestUser('factory').email,
      password: overrides.password || 'Test@123456',
      name: overrides.name || `Factory User ${Date.now()}`,
    };
  }

  static createWorkout(overrides: Partial<{ name: string; description: string; exercises: any[] }> = {}) {
    return {
      name: overrides.name || `Factory Workout ${Date.now()}`,
      description: overrides.description || 'Workout created by test factory',
      exercises: overrides.exercises || [
        { name: 'Supino Reto', sets: 3, reps: 10, weight: 60 },
      ],
    };
  }

  static createExercise(overrides: Partial<{ name: string; muscleGroup: string; equipment: string }> = {}) {
    return {
      name: overrides.name || `Factory Exercise ${Date.now()}`,
      muscleGroup: overrides.muscleGroup || 'Chest',
      equipment: overrides.equipment || 'Barbell',
    };
  }
}