import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class PlayerPage extends BasePage {
  readonly workoutName: Locator;
  readonly exerciseList: Locator;
  readonly currentExercise: Locator;
  readonly setCounter: Locator;
  readonly repCounter: Locator;
  readonly weightInput: Locator;
  readonly timer: Locator;
  readonly startButton: Locator;
  readonly pauseButton: Locator;
  readonly completeSetButton: Locator;
  readonly nextExerciseButton: Locator;
  readonly previousExerciseButton: Locator;
  readonly finishWorkoutButton: Locator;
  readonly restTimer: Locator;
  readonly skipRestButton: Locator;

  constructor(page: Page) {
    super(page);
    this.workoutName = page.locator('[data-testid="workout-name"], h1:has-text("Treino")');
    this.exerciseList = page.locator('[data-testid="exercise-list"], .exercise-list');
    this.currentExercise = page.locator('[data-testid="current-exercise"], .current-exercise');
    this.setCounter = page.locator('[data-testid="set-counter"], .set-counter');
    this.repCounter = page.locator('[data-testid="rep-counter"], .rep-counter');
    this.weightInput = page.locator('[data-testid="weight-input"], input[name="weight"], input[type="number"]');
    this.timer = page.locator('[data-testid="timer"], .timer');
    this.startButton = page.locator('[data-testid="start-workout"], button:has-text("Iniciar"), button:has-text("Começar")');
    this.pauseButton = page.locator('[data-testid="pause-workout"], button:has-text("Pausar")');
    this.completeSetButton = page.locator('[data-testid="complete-set"], button:has-text("Completar Série")');
    this.nextExerciseButton = page.locator('[data-testid="next-exercise"], button:has-text("Próximo")');
    this.previousExerciseButton = page.locator('[data-testid="prev-exercise"], button:has-text("Anterior")');
    this.finishWorkoutButton = page.locator('[data-testid="finish-workout"], button:has-text("Finalizar")');
    this.restTimer = page.locator('[data-testid="rest-timer"], .rest-timer');
    this.skipRestButton = page.locator('[data-testid="skip-rest"], button:has-text("Pular Descanso")');
  }

  async startWorkout(): Promise<void> {
    await this.waitForElement(this.startButton);
    await this.clickAndWait(this.startButton);
  }

  async completeSet(weight?: string, reps?: string): Promise<void> {
    if (weight) {
      await this.weightInput.fill(weight);
    }
    if (reps) {
      await this.repCounter.fill(reps);
    }
    await this.clickAndWait(this.completeSetButton);
  }

  async nextExercise(): Promise<void> {
    await this.clickAndWait(this.nextExerciseButton);
  }

  async previousExercise(): Promise<void> {
    await this.clickAndWait(this.previousExerciseButton);
  }

  async skipRest(): Promise<void> {
    if (await this.isVisible(this.skipRestButton)) {
      await this.clickAndWait(this.skipRestButton);
    }
  }

  async finishWorkout(): Promise<void> {
    await this.clickAndWait(this.finishWorkoutButton);
  }

  async getCurrentExerciseName(): Promise<string> {
    return await this.getText(this.currentExercise);
  }

  async getSetCount(): Promise<string> {
    return await this.getText(this.setCounter);
  }

  async waitForWorkoutLoad(): Promise<void> {
    await this.waitForElement(this.workoutName);
  }
}