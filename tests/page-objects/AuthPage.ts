import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class AuthPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerTab: Locator;
  readonly loginTab: Locator;
  readonly twoFactorInput: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('[data-testid="email-input"], input[type="email"], input[name="email"]');
    this.passwordInput = page.locator('[data-testid="password-input"], input[type="password"], input[name="password"]');
    this.loginButton = page.locator('[data-testid="login-button"], button[type="submit"]:has-text("Entrar"), button:has-text("Login")');
    this.registerTab = page.locator('[data-testid="register-tab"], button:has-text("Cadastrar"), a:has-text("Registrar")');
    this.loginTab = page.locator('[data-testid="login-tab"], button:has-text("Entrar"), a:has-text("Login")');
    this.twoFactorInput = page.locator('[data-testid="2fa-input"], input[name="totp"], input[autocomplete="one-time-code"]');
    this.errorMessage = page.locator('[data-testid="error-message"], .error, .alert-error, [role="alert"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password"], a:has-text("Esqueci a senha"), a:has-text("Forgot password")');
  }

  async login(email: string, password: string): Promise<void> {
    await this.waitForElement(this.emailInput);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.clickAndWait(this.loginButton);
  }

  async loginWith2FA(email: string, password: string, totpCode: string): Promise<void> {
    await this.login(email, password);
    if (await this.isVisible(this.twoFactorInput)) {
      await this.twoFactorInput.fill(totpCode);
      await this.clickAndWait(this.loginButton);
    }
  }

  async goToRegister(): Promise<void> {
    await this.clickAndWait(this.registerTab);
  }

  async goToLogin(): Promise<void> {
    await this.clickAndWait(this.loginTab);
  }

  async getErrorMessage(): Promise<string> {
    return await this.getText(this.errorMessage);
  }

  async clickForgotPassword(): Promise<void> {
    await this.clickAndWait(this.forgotPasswordLink);
  }
}