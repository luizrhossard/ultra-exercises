import { test, expect } from '@playwright/test';
import { TestDataManager, generateIsolatedTestData, TestDataFactory, SEEDED_TEST_DATA } from '../utils/test-data-manager';
import { API_ENDPOINTS } from '../utils/test-data';

test.describe('Test Data Management', () => {
  let testDataManager: TestDataManager;

  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
    
    testDataManager = new TestDataManager({
      request: page.request,
      baseURL: process.env.E2E_BACKEND_URL || 'http://localhost:3000',
    });
  });

  test.afterEach(async () => {
    if (process.env.E2E_BACKEND_URL) {
      await testDataManager.cleanupAll();
    }
  });

  test.describe('TestDataManager', () => {
    test('should create and track test users', async () => {
      const user = await testDataManager.createTestUser();
      
      expect(user.email).toContain('@test.ultraexercises.com');
      expect(user.token).toBeDefined();
      expect(user.token.length).toBeGreaterThan(0);
      
      const createdUsers = testDataManager.getCreatedUsers();
      expect(createdUsers).toContain(user.email);
    });

    test('should create multiple test users', async () => {
      const users = await testDataManager.createMultipleTestUsers(3);
      
      expect(users).toHaveLength(3);
      expect(testDataManager.getCreatedUsers()).toHaveLength(3);
      
      // All users should have unique emails
      const emails = users.map(u => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(3);
    });

    test('should create and track test workouts', async () => {
      // First create a user and login
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const workout = await testDataManager.createTestWorkout();
      
      expect(workout.id).toBeDefined();
      expect(workout.name).toBe(SEEDED_TEST_DATA.basicWorkout.name);
      
      const createdWorkouts = testDataManager.getCreatedWorkouts();
      expect(createdWorkouts).toContain(workout.id);
    });

    test('should create multiple test workouts', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const workouts = await testDataManager.createMultipleTestWorkouts(2);
      
      expect(workouts).toHaveLength(2);
      expect(testDataManager.getCreatedWorkouts()).toHaveLength(2);
    });

    test('should get workout by ID', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const created = await testDataManager.createTestWorkout();
      const fetched = await testDataManager.getTestWorkout(created.id);
      
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe(created.name);
    });

    test('should update workout', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const created = await testDataManager.createTestWorkout();
      const updated = await testDataManager.updateTestWorkout(created.id, {
        name: 'Updated Workout Name',
        description: 'Updated Description',
      });
      
      expect(updated.name).toBe('Updated Workout Name');
    });

    test('should delete workout', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const created = await testDataManager.createTestWorkout();
      await testDataManager.deleteTestWorkout(created.id);
      
      const createdWorkouts = testDataManager.getCreatedWorkouts();
      expect(createdWorkouts).not.toContain(created.id);
    });

    test('should search exercises', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const exercises = await testDataManager.searchExercises('supino');
      
      expect(Array.isArray(exercises)).toBe(true);
    });

    test('should get progress history', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const history = await testDataManager.getProgressHistory();
      
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get progress stats', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      const stats = await testDataManager.getProgressStats();
      
      expect(stats).toHaveProperty('totalWorkouts');
      expect(stats).toHaveProperty('totalVolume');
    });

    test('should cleanup all test data', async () => {
      const user = await testDataManager.createTestUser();
      testDataManager.setAuthToken(user.token);
      
      await testDataManager.createTestWorkout();
      await testDataManager.createTestWorkout();
      
      expect(testDataManager.getCreatedWorkouts().length).toBeGreaterThan(0);
      
      await testDataManager.cleanupAll();
      
      expect(testDataManager.getCreatedWorkouts()).toHaveLength(0);
      expect(testDataManager.getCreatedUsers()).toHaveLength(0);
    });
  });

  test.describe('generateIsolatedTestData', () => {
    test('should generate unique test data for parallel execution', () => {
      const data1 = generateIsolatedTestData('test1');
      const data2 = generateIsolatedTestData('test2');
      
      expect(data1.user.email).not.toBe(data2.user.email);
      expect(data1.workout.name).not.toBe(data2.workout.name);
      expect(data1.user.email).toContain('test1');
      expect(data2.user.email).toContain('test2');
    });

    test('should generate valid user data', () => {
      const data = generateIsolatedTestData('valid');
      
      expect(data.user.email).toMatch(/^[^@]+@test\.ultraexercises\.com$/);
      expect(data.user.password).toBe('Test@123456');
      expect(data.user.name).toContain('Parallel Test User');
    });

    test('should generate valid workout data', () => {
      const data = generateIsolatedTestData('workout');
      
      expect(data.workout.name).toContain('Parallel Workout');
      expect(data.workout.exercises).toHaveLength(2);
      expect(data.workout.exercises[0]).toHaveProperty('name');
      expect(data.workout.exercises[0]).toHaveProperty('sets');
      expect(data.workout.exercises[0]).toHaveProperty('reps');
      expect(data.workout.exercises[0]).toHaveProperty('weight');
    });
  });

  test.describe('TestDataFactory', () => {
    test('should create user with defaults', () => {
      const user = TestDataFactory.createUser();
      
      expect(user.email).toContain('@test.ultraexercises.com');
      expect(user.password).toBe('Test@123456');
      expect(user.name).toContain('Factory User');
    });

    test('should create user with overrides', () => {
      const user = TestDataFactory.createUser({
        email: 'custom@test.com',
        name: 'Custom Name',
      });
      
      expect(user.email).toBe('custom@test.com');
      expect(user.name).toBe('Custom Name');
      expect(user.password).toBe('Test@123456'); // default
    });

    test('should create workout with defaults', () => {
      const workout = TestDataFactory.createWorkout();
      
      expect(workout.name).toContain('Factory Workout');
      expect(workout.exercises).toHaveLength(1);
      expect(workout.exercises[0].name).toBe('Supino Reto');
    });

    test('should create workout with overrides', () => {
      const workout = TestDataFactory.createWorkout({
        name: 'Custom Workout',
        exercises: [
          { name: 'Custom Exercise', sets: 5, reps: 5, weight: 100 },
        ],
      });
      
      expect(workout.name).toBe('Custom Workout');
      expect(workout.exercises).toHaveLength(1);
      expect(workout.exercises[0].name).toBe('Custom Exercise');
    });

    test('should create exercise', () => {
      const exercise = TestDataFactory.createExercise();
      
      expect(exercise.name).toContain('Factory Exercise');
      expect(exercise.muscleGroup).toBe('Chest');
      expect(exercise.equipment).toBe('Barbell');
    });
  });

  test.describe('SEEDED_TEST_DATA', () => {
    test('should have standard user', () => {
      expect(SEEDED_TEST_DATA.standardUser).toHaveProperty('email');
      expect(SEEDED_TEST_DATA.standardUser).toHaveProperty('password');
      expect(SEEDED_TEST_DATA.standardUser).toHaveProperty('name');
    });

    test('should have admin user', () => {
      expect(SEEDED_TEST_DATA.adminUser).toHaveProperty('email');
      expect(SEEDED_TEST_DATA.adminUser).toHaveProperty('password');
      expect(SEEDED_TEST_DATA.adminUser).toHaveProperty('name');
    });

    test('should have user with 2FA', () => {
      expect(SEEDED_TEST_DATA.userWith2FA).toHaveProperty('email');
      expect(SEEDED_TEST_DATA.userWith2FA).toHaveProperty('password');
      expect(SEEDED_TEST_DATA.userWith2FA).toHaveProperty('has2FA', true);
      expect(SEEDED_TEST_DATA.userWith2FA).toHaveProperty('totpSecret');
    });

    test('should have basic workout', () => {
      expect(SEEDED_TEST_DATA.basicWorkout).toHaveProperty('name');
      expect(SEEDED_TEST_DATA.basicWorkout).toHaveProperty('description');
      expect(SEEDED_TEST_DATA.basicWorkout).toHaveProperty('exercises');
      expect(SEEDED_TEST_DATA.basicWorkout.exercises).toHaveLength(2);
    });

    test('should have advanced workout', () => {
      expect(SEEDED_TEST_DATA.advancedWorkout).toHaveProperty('name');
      expect(SEEDED_TEST_DATA.advancedWorkout).toHaveProperty('description');
      expect(SEEDED_TEST_DATA.advancedWorkout).toHaveProperty('exercises');
      expect(SEEDED_TEST_DATA.advancedWorkout.exercises).toHaveLength(3);
    });
  });
});

test.describe('Test Data Management - Public API (No Auth)', () => {
  test('should export test data utilities', async () => {
    // Verify all utilities are exported
    const { 
      TestDataManager, 
      generateIsolatedTestData, 
      TestDataFactory, 
      SEEDED_TEST_DATA,
      createTestDataManager 
    } = await import('../utils/test-data-manager');
    
    expect(TestDataManager).toBeDefined();
    expect(generateIsolatedTestData).toBeDefined();
    expect(TestDataFactory).toBeDefined();
    expect(SEEDED_TEST_DATA).toBeDefined();
    expect(createTestDataManager).toBeDefined();
  });
});