import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class AuthPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;
  readonly toggleModeButton: Locator;
  readonly twoFactorInput: Locator;
  readonly twoFactorSubmitButton: Locator;
  readonly twoFactorCancelButton: Locator;
  readonly twoFactorRecoveryButton: Locator;
  readonly errorMessage: Locator;
  readonly errorRef: Locator;

  constructor(page: Page) {
    super(page);
    // Form inputs
    this.emailInput = page.locator('input[type="email"][placeholder="E-mail"]');
    this.passwordInput = page.locator('input[type="password"][placeholder*="Senha"]');
    this.nameInput = page.locator('input[placeholder="Nome"]');
    
    // Buttons
    this.submitButton = page.locator('form button:has-text("Entrar"), form button:has-text("Criar conta")');
    this.toggleModeButton = page.locator('button:has-text("Ainda não tenho conta"), button:has-text("Já tenho uma conta")');
    
    // 2FA Challenge
    this.twoFactorInput = page.locator('#twofa-code, input[autocomplete="one-time-code"]');
    this.twoFactorSubmitButton = page.locator('button:has-text("Confirmar")');
    this.twoFactorCancelButton = page.locator('button:has-text("Voltar para o login")');
    this.twoFactorRecoveryButton = page.locator('button:has-text("Usar código de recuperação")');
    
    // Error messages
    this.errorMessage = page.locator('p[role="alert"]');
    this.errorRef = page.locator('p:has-text("Ref:")');
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<void> {
    await this.waitForElement(this.emailInput);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.clickAndWait(this.submitButton);
  }

  /**
   * Login with 2FA (if challenge is presented)
   */
  async loginWith2FA(email: string, password: string, totpCode: string): Promise<void> {
    await this.login(email, password);
    
    // Check if 2FA challenge appears
    if (await this.isVisible(this.twoFactorInput)) {
      await this.twoFactorInput.fill(totpCode);
      await this.clickAndWait(this.twoFactorSubmitButton);
    }
  }

  /**
   * Switch to register mode
   */
  async goToRegister(): Promise<void> {
    // Check if we're in login mode (button says "Ainda não tenho conta")
    const toggleText = await this.toggleModeButton.textContent();
    if (toggleText?.includes('Ainda não tenho conta')) {
      await this.clickAndWait(this.toggleModeButton);
    }
    // Wait for name input to appear (register mode)
    await this.waitForElement(this.nameInput);
  }

  /**
   * Switch to login mode
   */
  async goToLogin(): Promise<void> {
    // Check if we're in register mode (button says "Já tenho uma conta")
    const toggleText = await this.toggleModeButton.textContent();
    if (toggleText?.includes('Já tenho uma conta')) {
      await this.clickAndWait(this.toggleModeButton);
    }
    // Wait for name input to disappear (login mode)
    await this.page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="Nome"]');
      return !input || input.offsetParent === null;
    }, { timeout: 5000 });
  }

  /**
   * Register a new user
   */
  async register(name: string, email: string, password: string): Promise<void> {
    await this.goToRegister();
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.clickAndWait(this.submitButton);
  }

  /**
   * Submit 2FA code
   */
  async submit2FA(code: string): Promise<void> {
    await this.waitForElement(this.twoFactorInput);
    await this.twoFactorInput.fill(code);
    await this.clickAndWait(this.twoFactorSubmitButton);
  }

  /**
   * Cancel 2FA challenge and return to login
   */
  async cancel2FA(): Promise<void> {
    await this.clickAndWait(this.twoFactorCancelButton);
  }

  /**
   * Switch to recovery code mode in 2FA
   */
  async useRecoveryCode(): Promise<void> {
    await this.clickAndWait(this.twoFactorRecoveryButton);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.isVisible(this.errorMessage)) {
      return await this.getText(this.errorMessage);
    }
    return '';
  }

  /**
   * Get error reference (trace ID)
   */
  async getErrorRef(): Promise<string | null> {
    if (await this.isVisible(this.errorRef)) {
      const text = await this.getText(this.errorRef);
      return text.replace('Ref: ', '').trim();
    }
    return null;
  }

  /**
   * Check if currently in login mode
   */
  async isLoginMode(): Promise<boolean> {
    const toggleText = await this.toggleModeButton.textContent();
    return toggleText?.includes('Ainda não tenho conta') ?? true;
  }

  /**
   * Check if currently in register mode
   */
  async isRegisterMode(): Promise<boolean> {
    const toggleText = await this.toggleModeButton.textContent();
    return toggleText?.includes('Já tenho uma conta') ?? false;
  }

  /**
   * Check if 2FA challenge is visible
   */
  async is2FAChallengeVisible(): Promise<boolean> {
    return await this.isVisible(this.twoFactorInput);
  }

  /**
   * Check if in recovery code mode
   */
  async isRecoveryMode(): Promise<boolean> {
    const placeholder = await this.twoFactorInput.getAttribute('placeholder');
    return placeholder === 'XXXX-XXXX';
  }
}