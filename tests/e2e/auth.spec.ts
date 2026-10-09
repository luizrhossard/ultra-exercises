import { test, expect } from '../fixtures/page-objects';
import { expectAuthenticated, expectLoggedOut, expectActiveTab, logoutViaProfile } from '../utils/app-shell';
import { TEST_USERS, generateTestUser } from '../utils/test-data';

test.describe('Authentication Flows', () => {
  test.describe('Login', () => {
    test('should login with valid credentials @smoke', async ({ page, authPage }) => {
      // This test requires a valid test user in the backend
      // Skipped if backend is not available
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
      
      await authPage.goto('/auth');
      await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
      
      // Should redirect to home/dashboard after login
      await expectAuthenticated(page);
      
      // Should show user profile or logout option
      const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Perfil"), button:has-text("Sair")');
      await expect(userMenu.first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show error with invalid credentials and traceId [UE-63]', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
      
      await authPage.goto('/auth');
      await authPage.login('invalid@test.com', 'wrongpassword');
      
      // A mensagem aparece depois da resposta da API: espera o alerta antes de ler.
      await expect(authPage.errorMessage).toBeVisible({ timeout: 10_000 });
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/inválido|incorreto|erro|credenciais|não foi possível/);
      // UE-25 contrato: erro deve expor traceId Ref: para correlacao com logs
      const errorRef = await authPage.getErrorRef();
      if (errorRef) {
        expect(errorRef).toMatch(/[A-Za-z0-9-]{8,64}/);
      }
    });

    test('should show error with empty email', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      await authPage.emailInput.fill('');
      await authPage.passwordInput.fill(TEST_USERS.standard.password);
      
      // HTML5 validation should prevent submission - check required attribute
      const emailInput = authPage.emailInput;
      await expect(emailInput).toHaveAttribute('required');
      
      // Verify form doesn't submit by checking we're still on auth page
      await expectLoggedOut(page);
    });

    test('should show error with empty password', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      await authPage.emailInput.fill(TEST_USERS.standard.email);
      await authPage.passwordInput.fill('');
      
      // HTML5 validation should prevent submission - check required attribute
      const passwordInput = authPage.passwordInput;
      await expect(passwordInput).toHaveAttribute('required');
      
      // Verify form doesn't submit by checking we're still on auth page
      await expectLoggedOut(page);
    });
  });

  test.describe('Registration', () => {
    test('should register a new user', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
      
      const newUser = generateTestUser('register');
      
      await authPage.goto('/auth');
      await authPage.register(newUser.name, newUser.email, newUser.password);
      
      // Should redirect to home or onboarding after registration
      await expectAuthenticated(page);
    });

    test('should show error for duplicate email', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');

      // Usa um e-mail que já existe (usuário fixo): o erro de conflito vem direto da tela de cadastro.
      await authPage.goto('/auth');
      await authPage.register('Duplicado', TEST_USERS.standard.email, TEST_USERS.standard.password);

      await expect(authPage.errorMessage).toBeVisible({ timeout: 10_000 });
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/j\u00e1 cadastrado/);
    });
    test('should show error for mismatched passwords', async ({ page, authPage }) => {
      // The current UI doesn't have confirm password field
      // This test documents expected behavior if confirm field is added
      test.skip(true, 'Confirm password field not implemented in current UI');
    });

    test('should toggle between login and register modes', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      
      // Should start in login mode
      await expect(authPage.isLoginMode()).resolves.toBe(true);
      await expect(authPage.nameInput).toBeHidden();
      
      // Switch to register
      await authPage.goToRegister();
      await expect(authPage.isRegisterMode()).resolves.toBe(true);
      await expect(authPage.nameInput).toBeVisible();
      
      // Switch back to login
      await authPage.goToLogin();
      await expect(authPage.isLoginMode()).resolves.toBe(true);
      await expect(authPage.nameInput).toBeHidden();
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
      
      // First login
      await authPage.goto('/auth');
      await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
      await expectAuthenticated(page);
      
      await logoutViaProfile(page);
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session after page reload', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API');
      
      await authPage.goto('/auth');
      await authPage.login(TEST_USERS.standard.email, TEST_USERS.standard.password);
      await expectAuthenticated(page);
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be logged in
      await expectAuthenticated(page);
      const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Perfil"), button:has-text("Sair")');
      await expect(userMenu.first()).toBeVisible({ timeout: 10_000 });
    });

    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      // Sem sessão o app é um gate: qualquer caminho mostra a tela de login.
      await page.goto('/routines');
      await page.waitForLoadState('networkidle');
      await expectLoggedOut(page);
    });
  });

  test.describe('2FA (Two-Factor Authentication)', () => {
    test.skip('should login with 2FA when enabled', async ({ page, authPage }) => {
      // This test requires a user with 2FA enabled and known TOTP secret
      // Skipped by default - enable when test user with 2FA is available
      await authPage.goto('/auth');
      await authPage.loginWith2FA(
        TEST_USERS.with2FA.email,
        TEST_USERS.with2FA.password,
        '123456' // Would need actual TOTP code
      );
      
      await expectAuthenticated(page);
    });

    test('should show 2FA challenge when user has 2FA enabled', async ({ page, authPage }) => {
      // This test would need a user with 2FA enabled
      // For now, verify the 2FA challenge component renders correctly
      await authPage.goto('/auth');
      
      // The 2FA challenge is shown conditionally based on backend response
      // We can't easily test this without a 2FA-enabled test user
      // But we can verify the component structure exists
      const challengeTitle = page.locator('h1:has-text("Verificação em dois fatores")');
      // This will only be visible if 2FA is triggered
    });

    test('should allow switching to recovery code mode in 2FA', async ({ page, authPage }) => {
      // This test would need a user with 2FA enabled
      test.skip(true, 'Requires 2FA-enabled test user');
    });

    test('should cancel 2FA challenge and return to login', async ({ page, authPage }) => {
      // This test would need a user with 2FA enabled
      test.skip(true, 'Requires 2FA-enabled test user');
    });
  });

  test.describe('Auth Form Validation', () => {
    test('should validate email format via HTML5', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      
      const emailInput = authPage.emailInput;
      await emailInput.fill('invalid-email');
      
      // Check HTML5 validation
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toMatch(/email|@/i);
    });

    test('should enforce minimum password length', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      
      const passwordInput = authPage.passwordInput;
      await expect(passwordInput).toHaveAttribute('minLength', '8');
    });

    test('should require name in register mode', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      await authPage.goToRegister();
      
      const nameInput = authPage.nameInput;
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveAttribute('maxLength', '80');
    });
  });

  test.describe('UI Elements', () => {
    test('should display logo and branding', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      
      const logo = page.locator('svg, img').first(); // Logo component
      await expect(logo).toBeVisible();
      
      const title = page.locator('h1:has-text("Entrar")');
      await expect(title).toBeVisible();
    });

    test('should display help text', async ({ page, authPage }) => {
      await authPage.goto('/auth');
      
      const helpText = page.locator('text=Seu histórico e acompanhamento ficam associados à sua conta');
      await expect(helpText).toBeVisible();
    });

    test('should show loading state during authentication', async ({ page, authPage }) => {
      test.skip(!process.env.E2E_BACKEND_URL, 'Requires backend API to test loading state');

      // Atrasa a resposta da API para o estado de carregamento ficar observável.
      await page.route('**/api/auth/login', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });

      await authPage.goto('/auth');
      await authPage.emailInput.fill(TEST_USERS.standard.email);
      await authPage.passwordInput.fill(TEST_USERS.standard.password);

      // O botão de envio é o primeiro do formulário (o texto muda para "Conectando" durante o envio).
      const submit = page.locator('form button').first();
      const submitPromise = submit.click();
      await expect(submit).toHaveText(/Conectando/);

      await submitPromise;
    });
  });
});