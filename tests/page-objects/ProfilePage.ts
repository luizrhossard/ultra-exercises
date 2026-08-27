import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProfilePage extends BasePage {
  readonly profileForm: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly sportSelect: Locator;
  readonly saveButton: Locator;
  readonly avatarUpload: Locator;
  readonly twoFactorSection: Locator;
  readonly enable2FAButton: Locator;
  readonly qrCode: Locator;
  readonly backupCodes: Locator;

  constructor(page: Page) {
    super(page);
    this.profileForm = page.locator('[data-testid="profile-form"], form:has(input[name="name"])');
    this.nameInput = page.locator('[data-testid="profile-name"], input[name="name"]');
    this.emailInput = page.locator('[data-testid="profile-email"], input[name="email"]');
    this.sportSelect = page.locator('[data-testid="profile-sport"], select[name="sport"]');
    this.saveButton = page.locator('[data-testid="save-profile"], button[type="submit"]:has-text("Salvar")');
    this.avatarUpload = page.locator('[data-testid="avatar-upload"], input[type="file"][accept*="image"]');
    this.twoFactorSection = page.locator('[data-testid="2fa-section"], .two-factor-section');
    this.enable2FAButton = page.locator('[data-testid="enable-2fa"], button:has-text("Ativar 2FA")');
    this.qrCode = page.locator('[data-testid="qr-code"], img[alt*="QR" i]');
    this.backupCodes = page.locator('[data-testid="backup-codes"], .backup-codes');
  }

  async updateProfile(data: { name?: string; email?: string; sport?: string }): Promise<void> {
    await this.waitForElement(this.profileForm);
    if (data.name) {
      await this.nameInput.fill(data.name);
    }
    if (data.email) {
      await this.emailInput.fill(data.email);
    }
    if (data.sport) {
      await this.sportSelect.selectOption(data.sport);
    }
    await this.clickAndWait(this.saveButton);
  }

  async uploadAvatar(filePath: string): Promise<void> {
    await this.avatarUpload.setInputFiles(filePath);
    await this.page.waitForLoadState('networkidle');
  }

  async enable2FA(): Promise<string[]> {
    await this.clickAndWait(this.enable2FAButton);
    await this.waitForElement(this.qrCode);
    // Get backup codes
    const codesText = await this.getText(this.backupCodes);
    return codesText.split('\n').filter(c => c.trim());
  }

  async getProfileData(): Promise<{ name: string; email: string; sport: string }> {
    return {
      name: await this.nameInput.inputValue(),
      email: await this.emailInput.inputValue(),
      sport: await this.sportSelect.inputValue(),
    };
  }
}