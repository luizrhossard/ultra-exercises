import { expect, Page } from '@playwright/test';

/**
 * Helpers do shell do Ultra Exercises.
 *
 * O frontend é uma SPA sem roteamento por URL: a navegação entre telas é feita por
 * estado (abas da sidebar/BottomNav). Por isso as asserções usam o estado da UI, e
 * não a URL. Ver src/App.tsx e src/components/Sidebar.tsx.
 */

export type AppTab = 'Explorar' | 'Rotinas' | 'Progresso' | 'Perfil';

/** Caminhos antigos dos testes -> aba equivalente no app. '/auth' é a tela de login (raiz). */
export const TAB_BY_PATH: Record<string, AppTab | undefined> = {
  '/exercises': 'Explorar',
  '/routines': 'Rotinas',
  '/progress': 'Progresso',
  '/profile': 'Perfil',
};

/** Botão de aba da sidebar (o nome acessível inclui a dica, ex.: "Rotinas Gerador + salvas"). */
export function tabButton(page: Page, tab: AppTab) {
  return page.getByRole('button', { name: new RegExp(`^${tab}\\b`) }).first();
}

/** Usuário autenticado e com o shell principal visível (sidebar com as abas). */
export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(tabButton(page, 'Explorar')).toBeVisible({ timeout: 15_000 });
}

/** Tela de login visível (sem sessão). */
export async function expectLoggedOut(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });
}

/** Aba ativa do shell (aria-current="page"). */
export async function expectActiveTab(page: Page, tab: AppTab): Promise<void> {
  await expect(tabButton(page, tab)).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });
}

/** Sai da conta pela aba Perfil (elemento data-testid="logout") e espera a tela de login. */
export async function logoutViaProfile(page: Page): Promise<void> {
  await tabButton(page, 'Perfil').click();
  await page.getByTestId('logout').click();
  await expectLoggedOut(page);
}
