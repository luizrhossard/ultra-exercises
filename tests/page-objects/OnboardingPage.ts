import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class OnboardingPage extends BasePage {
  readonly welcomeScreen: Locator;
  readonly goalSelection: Locator;
  readonly experienceSelection: Locator;
  readonly frequencySelection: Locator;
  readonly sportSelection: Locator;
  readonly nextButton: Locator;
  readonly skipButton: Locator;
  readonly progressIndicator: Locator;
  readonly completionScreen: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeScreen = page.locator('[data-testid="onboarding-welcome"], .onboarding-welcome');
    this.goalSelection = page.locator('[data-testid="goal-selection"], .goal-selection');
    this.experienceSelection = page.locator('[data-testid="experience-selection"], .experience-selection');
    this.frequencySelection = page.locator('[data-testid="frequency-selection"], .frequency-selection');
    this.sportSelection = page.locator('[data-testid="sport-selection"], .sport-selection');
    this.nextButton = page.locator('[data-testid="onboarding-next"], button:has-text("Próximo"), button:has-text("Continuar")');
    this.skipButton = page.locator('[data-testid="onboarding-skip"], button:has-text("Pular"), a:has-text("Pular")');
    this.progressIndicator = page.locator('[data-testid="onboarding-progress"], .progress-bar, .step-indicator');
    this.completionScreen = page.locator('[data-testid="onboarding-complete"], .onboarding-complete');
  }

  async skipOnboarding(): Promise<void> {
    if (await this.isVisible(this.skipButton)) {
      await this.clickAndWait(this.skipButton);
    }
  }

  async selectGoal(goal: string): Promise<void> {
    await this.waitForElement(this.goalSelection);
    const option = this.page.locator(`[data-testid="goal-${goal}"], button:has-text("${goal}"), label:has-text("${goal}")`);
    await this.clickAndWait(option);
    await this.clickAndWait(this.nextButton);
  }

  async selectExperience(level: 'beginner' | 'intermediate' | 'advanced'): Promise<void> {
    await this.waitForElement(this.experienceSelection);
    const option = this.page.locator(`[data-testid="exp-${level}"], button:has-text("${level}"), label:has-text("${level}")`);
    await this.clickAndWait(option);
    await this.clickAndWait(this.nextButton);
  }

  async selectFrequency(days: number): Promise<void> {
    await this.waitForElement(this.frequencySelection);
    const option = this.page.locator(`[data-testid="freq-${days}"], button:has-text("${days}"), label:has-text("${days}")`);
    await this.clickAndWait(option);
    await this.clickAndWait(this.nextButton);
  }

  async selectSports(sports: string[]): Promise<void> {
    await this.waitForElement(this.sportSelection);
    for (const sport of sports) {
      const option = this.page.locator(`[data-testid="sport-${sport}"], button:has-text("${sport}"), label:has-text("${sport}")`);
      await this.clickAndWait(option);
    }
    await this.clickAndWait(this.nextButton);
  }

  async completeOnboarding(): Promise<void> {
    await this.waitForElement(this.completionScreen);
    const finishButton = this.page.locator('[data-testid="finish-onboarding"], button:has-text("Começar"), button:has-text("Finalizar")');
    await this.clickAndWait(finishButton);
  }

  async getCurrentStep(): Promise<number> {
    const progress = await this.getText(this.progressIndicator);
    const match = progress.match(/(\d+)\s*\/\s*\d+/);
    return match ? parseInt(match[1], 10) : 1;
  }
}