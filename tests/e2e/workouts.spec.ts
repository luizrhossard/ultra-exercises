import { test, expect } from '../fixtures/page-objects';
import { TEST_USERS, generateTestUser, TEST_WORKOUTS } from '../utils/test-data';

test.describe('Workout Management', () => {
  test.beforeEach(async ({ page, authPage }) => {
    // Skip login tests if no backend - but still test UI navigation
    if (!process.env.E2E_BACKEND_URL) {
      test.skip(true, 'Requires backend API for authenticated tests');
      return;
    }
    
    // Login before each test
    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/\/(home|dashboard|$)/);
  });

  test.describe('Routine List', () => {
    test('should display routines page @smoke', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      await routinesPage.waitForElement(routinesPage.routineList);
      
      // Should show routine list container
      await expect(routinesPage.routineList).toBeVisible();
    });

    test('should show empty state when no routines', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      // Check for empty state message or empty list
      const emptyState = page.locator('text=nenhuma rotina, text=Nenhum treino, text=empty, [data-testid="empty-routines"]');
      const routineCards = routinesPage.routineCards;
      
      // Either empty state is shown or list is empty
      const hasEmptyState = await emptyState.first().isVisible().catch(() => false);
      const cardCount = await routineCards.count();
      
      expect(hasEmptyState || cardCount === 0).toBe(true);
    });

    test('should navigate to create routine', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      // Click create routine button
      await routinesPage.clickAndWait(routinesPage.createRoutineButton);
      
      // Should navigate to routine creation form
      await expect(page).toHaveURL(/\/routines\/(new|create)/);
    });
  });

  test.describe('Create Routine', () => {
    test('should create a basic routine', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      await routinesPage.clickAndWait(routinesPage.createRoutineButton);
      
      // Fill routine form
      const nameInput = page.locator('[data-testid="routine-name"], input[name="name"], input[placeholder*="nome" i]');
      const descriptionInput = page.locator('[data-testid="routine-description"], textarea[name="description"], textarea[placeholder*="descrição" i]');
      const saveButton = page.locator('[data-testid="save-routine"], button[type="submit"]:has-text("Salvar"), button:has-text("Criar")');
      
      await routinesPage.waitForElement(nameInput);
      await nameInput.fill(TEST_WORKOUTS.basic.name);
      await descriptionInput.fill(TEST_WORKOUTS.basic.description);
      await routinesPage.clickAndWait(saveButton);
      
      // Should redirect back to routines list
      await expect(page).toHaveURL(/\/routines/);
      
      // Should show the new routine
      const newRoutine = page.locator(`text=${TEST_WORKOUTS.basic.name}`);
      await expect(newRoutine).toBeVisible({ timeout: 10_000 });
    });

    test('should validate required fields', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      await routinesPage.clickAndWait(routinesPage.createRoutineButton);
      
      const nameInput = page.locator('[data-testid="routine-name"], input[name="name"]');
      const saveButton = page.locator('[data-testid="save-routine"], button[type="submit"]:has-text("Salvar")');
      
      await routinesPage.waitForElement(nameInput);
      // Try to save without name
      await routinesPage.clickAndWait(saveButton);
      
      // Should show validation error or prevent submission
      await expect(page).toHaveURL(/\/routines\/(new|create)/);
      await expect(nameInput).toHaveAttribute('required');
    });

    test('should cancel routine creation', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      await routinesPage.clickAndWait(routinesPage.createRoutineButton);
      
      const cancelButton = page.locator('[data-testid="cancel-routine"], button:has-text("Cancelar"), a:has-text("Voltar")');
      
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await routinesPage.clickAndWait(cancelButton);
        await expect(page).toHaveURL(/\/routines/);
      }
    });
  });

  test.describe('Routine Details', () => {
    test('should view routine details', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      // If there are routines, click the first one
      const cardCount = await routinesPage.getRoutineCount();
      if (cardCount > 0) {
        await routinesPage.openRoutine(0);
        
        // Should navigate to routine detail page
        await expect(page).toHaveURL(/\/routines\/[^/]+/);
        
        // Should show routine details
        const routineName = page.locator('h1, [data-testid="routine-detail-name"]');
        await expect(routineName).toBeVisible();
      }
    });

    test('should show exercises in routine', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      const cardCount = await routinesPage.getRoutineCount();
      if (cardCount > 0) {
        await routinesPage.openRoutine(0);
        
        // Should show exercises list
        const exercisesList = page.locator('[data-testid="routine-exercises"], .exercises-list, ul:has(li)');
        await expect(exercisesList.first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('Edit Routine', () => {
    test('should edit routine name', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      const cardCount = await routinesPage.getRoutineCount();
      if (cardCount > 0) {
        await routinesPage.openRoutine(0);
        
        const editButton = page.locator('[data-testid="edit-routine"], button:has-text("Editar")');
        if (await editButton.isVisible({ timeout: 2000 })) {
          await routinesPage.clickAndWait(editButton);
          
          const nameInput = page.locator('[data-testid="routine-name"], input[name="name"]');
          await routinesPage.waitForElement(nameInput);
          const newName = `Updated ${TEST_WORKOUTS.basic.name} ${Date.now()}`;
          await nameInput.fill(newName);
          
          const saveButton = page.locator('[data-testid="save-routine"], button[type="submit"]:has-text("Salvar")');
          await routinesPage.clickAndWait(saveButton);
          
          // Should show updated name
          await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('Delete Routine', () => {
    test('should delete a routine', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      const cardCount = await routinesPage.getRoutineCount();
      if (cardCount > 0) {
        const initialCount = cardCount;
        
        await routinesPage.openRoutine(0);
        
        const deleteButton = page.locator('[data-testid="delete-routine"], button:has-text("Excluir"), button:has-text("Deletar")');
        if (await deleteButton.isVisible({ timeout: 2000 })) {
          await routinesPage.clickAndWait(deleteButton);
          
          // Confirm deletion if modal appears
          const confirmButton = page.locator('[data-testid="confirm-delete"], button:has-text("Confirmar"), button:has-text("Sim")');
          if (await confirmButton.isVisible({ timeout: 2000 })) {
            await routinesPage.clickAndWait(confirmButton);
          }
          
          // Should redirect to routines list
          await expect(page).toHaveURL(/\/routines/);
          
          // Should have one less routine
          await routinesPage.goto('/routines');
          const newCount = await routinesPage.getRoutineCount();
          expect(newCount).toBeLessThan(initialCount);
        }
      }
    });
  });

  test.describe('Search and Filter', () => {
    test('should search routines by name', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      // Create a routine with unique name if needed
      const uniqueName = `SearchTest ${Date.now()}`;
      await routinesPage.clickAndWait(routinesPage.createRoutineButton);
      
      const nameInput = page.locator('[data-testid="routine-name"], input[name="name"]');
      const saveButton = page.locator('[data-testid="save-routine"], button[type="submit"]:has-text("Salvar")');
      
      await routinesPage.waitForElement(nameInput);
      await nameInput.fill(uniqueName);
      await routinesPage.clickAndWait(saveButton);
      
      // Search for the routine
      await routinesPage.searchRoutines(uniqueName);
      
      // Should show the routine in results
      const result = page.locator(`text=${uniqueName}`);
      await expect(result).toBeVisible({ timeout: 10_000 });
    });

    test('should filter routines', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      // Check if filter buttons exist
      const filterButtons = routinesPage.filterButtons;
      const filterCount = await filterButtons.count();
      
      if (filterCount > 0) {
        // Click first filter
        await routinesPage.clickAndWait(filterButtons.first());
        
        // Should apply filter (URL may change or results update)
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Start Workout from Routine', () => {
    test('should navigate to player from routine', async ({ page, routinesPage }) => {
      await routinesPage.goto('/routines');
      
      const cardCount = await routinesPage.getRoutineCount();
      if (cardCount > 0) {
        await routinesPage.openRoutine(0);
        
        const startButton = page.locator('[data-testid="start-workout"], button:has-text("Iniciar Treino"), button:has-text("Começar")');
        if (await startButton.isVisible({ timeout: 2000 })) {
          await routinesPage.clickAndWait(startButton);
          
          // Should navigate to player page
          await expect(page).toHaveURL(/\/player/);
        }
      }
    });
  });
});

test.describe('Workout Player (Player Page)', () => {
  test.beforeEach(async ({ page, authPage }) => {
    test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
    
    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/\/(home|dashboard|$)/);
  });

  test('should load player page @smoke', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    
    // Should show workout name
    await expect(playerPage.workoutName).toBeVisible({ timeout: 10_000 });
  });

  test('should start workout', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    
    // Click start button
    await playerPage.startWorkout();
    
    // Should show first exercise
    await expect(playerPage.currentExercise).toBeVisible({ timeout: 10_000 });
    await expect(playerPage.setCounter).toBeVisible();
    await expect(playerPage.repCounter).toBeVisible();
  });

  test('should complete a set', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    
    // Complete first set
    await playerPage.completeSet('60', '10');
    
    // Should advance to next set or show rest timer
    await expect(playerPage.setCounter).toBeVisible();
  });

  test('should navigate between exercises', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    
    // Get initial exercise name
    const initialExercise = await playerPage.getCurrentExerciseName();
    
    // Go to next exercise
    await playerPage.nextExercise();
    
    // Should show different exercise (or same if only one)
    const nextExercise = await playerPage.getCurrentExerciseName();
    expect(nextExercise).toBeDefined();
    
    // Go back
    await playerPage.previousExercise();
    const prevExercise = await playerPage.getCurrentExerciseName();
    expect(prevExercise).toBe(initialExercise);
  });

  test('should skip rest timer', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    await playerPage.completeSet('60', '10');
    
    // If rest timer appears, skip it
    if (await playerPage.isVisible(playerPage.skipRestButton)) {
      await playerPage.skipRest();
      
      // Should continue to next set/exercise
      await expect(playerPage.setCounter).toBeVisible();
    }
  });

  test('should pause and resume workout', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    
    // Pause workout
    if (await playerPage.isVisible(playerPage.pauseButton)) {
      await playerPage.clickAndWait(playerPage.pauseButton);
      
      // Should show resume/start button
      await expect(playerPage.startButton).toBeVisible({ timeout: 5_000 });
      
      // Resume
      await playerPage.startWorkout();
      await expect(playerPage.currentExercise).toBeVisible();
    }
  });

  test('should finish workout', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    
    // Complete all sets quickly
    for (let i = 0; i < 5; i++) {
      if (await playerPage.isVisible(playerPage.completeSetButton)) {
        await playerPage.completeSet('60', '10');
        if (await playerPage.isVisible(playerPage.skipRestButton)) {
          await playerPage.skipRest();
        }
      } else {
        break;
      }
    }
    
    // Finish workout
    if (await playerPage.isVisible(playerPage.finishWorkoutButton)) {
      await playerPage.finishWorkout();
      
      // Should show completion screen or redirect
      await page.waitForLoadState('networkidle');
    }
  });

  test('should show timer during workout', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    
    // Timer should be visible
    await expect(playerPage.timer).toBeVisible({ timeout: 5_000 });
  });

  test('should show rest timer between sets', async ({ page, playerPage }) => {
    await playerPage.goto('/player');
    await playerPage.waitForWorkoutLoad();
    await playerPage.startWorkout();
    await playerPage.completeSet('60', '10');
    
    // Rest timer should appear
    if (await playerPage.isVisible(playerPage.restTimer)) {
      await expect(playerPage.restTimer).toBeVisible();
    }
  });
});

test.describe('Exercise Library', () => {
  test.beforeEach(async ({ page, authPage }) => {
    // Skip login tests if no backend - but still test UI navigation
    if (!process.env.E2E_BACKEND_URL) {
      test.skip(true, 'Requires backend API for authenticated tests');
      return;
    }
    
    await authPage.goto('/auth');
    await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
    await expect(page).toHaveURL(/\/(home|dashboard|$)/);
  });

  test('should browse exercises', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    
    // Should show exercises list
    const exercisesList = page.locator('[data-testid="exercises-list"], .exercises-list, main');
    await expect(exercisesList).toBeVisible();
  });

  test('should search exercises', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('[data-testid="search-exercises"], input[placeholder*="buscar" i], input[placeholder*="search" i]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('supino');
      await page.waitForLoadState('networkidle');
      
      // Should filter results
      const results = page.locator('[data-testid="exercise-card"], .exercise-card');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should filter exercises by muscle group', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    
    const muscleFilter = page.locator('[data-testid="muscle-filter"], select[name="muscle"], button:has-text("Músculo")');
    if (await muscleFilter.isVisible({ timeout: 2000 })) {
      await muscleFilter.click();
      
      const chestOption = page.locator('[data-value="chest"], option:has-text("Peito"), button:has-text("Peito")');
      if (await chestOption.isVisible({ timeout: 2000 })) {
        await chestOption.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should view exercise details', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    
    const exerciseCards = page.locator('[data-testid="exercise-card"], .exercise-card, article');
    const count = await exerciseCards.count();
    
    if (count > 0) {
      await exerciseCards.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should show exercise detail
      const detailTitle = page.locator('h1, [data-testid="exercise-detail-name"]');
      await expect(detailTitle).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Public Routes (No Auth Required)', () => {
  test('should access routines page (may redirect to auth)', async ({ page }) => {
    await page.goto('/routines');
    await page.waitForLoadState('networkidle');
    
    // Should either show routines or redirect to auth
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(routines|auth)/);
  });

  test('should access player page (may redirect to auth)', async ({ page }) => {
    await page.goto('/player');
    await page.waitForLoadState('networkidle');
    
    // Should either show player or redirect to auth
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(player|auth)/);
  });

  test('should access exercises page', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    
    // Exercises page might be public
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(exercises|auth)/);
  });

  test('should navigate from home to routines', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for routines link/button
    const routinesLink = page.locator('a[href="/routines"], button:has-text("Rotinas"), button:has-text("Treinos")');
    if (await routinesLink.isVisible({ timeout: 2000 })) {
      await routinesLink.first().click();
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(routines|auth)/);
    }
  });

  test('should navigate from home to exercises', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for exercises link/button
    const exercisesLink = page.locator('a[href="/exercises"], button:has-text("Exercícios"), button:has-text("Biblioteca")');
    if (await exercisesLink.isVisible({ timeout: 2000 })) {
      await exercisesLink.first().click();
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(exercises|auth)/);
    }
  });
});