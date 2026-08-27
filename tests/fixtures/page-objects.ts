import { test as base, Page } from '@playwright/test';
import { AuthPage } from '../page-objects/AuthPage';
import { RoutinesPage } from '../page-objects/RoutinesPage';
import { ProgressPage } from '../page-objects/ProgressPage';
import { ProfilePage } from '../page-objects/ProfilePage';
import { FeedPage } from '../page-objects/FeedPage';
import { PlayerPage } from '../page-objects/PlayerPage';
import { OnboardingPage } from '../page-objects/OnboardingPage';

interface PageObjectFixtures {
  authPage: AuthPage;
  routinesPage: RoutinesPage;
  progressPage: ProgressPage;
  profilePage: ProfilePage;
  feedPage: FeedPage;
  playerPage: PlayerPage;
  onboardingPage: OnboardingPage;
}

export const test = base.extend<PageObjectFixtures>({
  authPage: async ({ page }, use) => {
    const authPage = new AuthPage(page);
    await use(authPage);
  },

  routinesPage: async ({ page }, use) => {
    const routinesPage = new RoutinesPage(page);
    await use(routinesPage);
  },

  progressPage: async ({ page }, use) => {
    const progressPage = new ProgressPage(page);
    await use(progressPage);
  },

  profilePage: async ({ page }, use) => {
    const profilePage = new ProfilePage(page);
    await use(profilePage);
  },

  feedPage: async ({ page }, use) => {
    const feedPage = new FeedPage(page);
    await use(feedPage);
  },

  playerPage: async ({ page }, use) => {
    const playerPage = new PlayerPage(page);
    await use(playerPage);
  },

  onboardingPage: async ({ page }, use) => {
    const onboardingPage = new OnboardingPage(page);
    await use(onboardingPage);
  },
});

export { expect } from '@playwright/test';