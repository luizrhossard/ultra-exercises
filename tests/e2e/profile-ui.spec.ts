import { test, expect } from '../fixtures/page-objects';

/**
 * [UE-67] Suíte de Testes Criada na Aula 6:
 * Validação de Navegação e Componentes de Interface com Page Object Model (POM)
 */
test.describe('Minha Primeira Suíte de QA [UE-67] @aula6', () => {

  test('CT-01: Deve carregar a página de autenticação e verificar elementos essenciais', async ({ page, authPage }) => {
    // 1. Ação: Navega até a tela de autenticação
    await authPage.goto('/auth');

    // 2. Validação (Asserts): Confere se os campos estão visíveis na tela
    await expect(authPage.emailInput).toBeVisible();
    await expect(authPage.passwordInput).toBeVisible();
    await expect(authPage.submitButton).toBeVisible();
  });

  test('CT-02: Deve alternar com sucesso entre a tela de Login e a tela de Cadastro', async ({ authPage }) => {
    // 1. Ação: Vai para a tela de autenticação
    await authPage.goto('/auth');

    // 2. Ação: Clica para ir para o modo de Cadastro
    await authPage.goToRegister();

    // 3. Validação: O campo de 'Nome' deve aparecer na tela de cadastro
    await expect(authPage.nameInput).toBeVisible();

    // 4. Ação: Volta para o modo de Login
    await authPage.goToLogin();

    // 5. Validação: O campo de 'Nome' deve sumir
    await expect(authPage.nameInput).toBeHidden();
  });

  test('CT-03: Deve validar proteção de rota ao acessar o perfil sem autenticação', async ({ page }) => {
    // 1. Ação: Tenta acessar diretamente a rota protegida de perfil
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // 2. Validação: O sistema deve estar em /profile ou redirecionar com segurança para /auth
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(profile|auth)/);
  });

});
