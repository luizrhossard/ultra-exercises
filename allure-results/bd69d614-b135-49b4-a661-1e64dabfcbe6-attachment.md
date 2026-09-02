# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke Tests [UE-63] @smoke >> should navigate to critical journeys without backend @smoke
- Location: tests\e2e\smoke.spec.ts:20:3

# Error details

```
Error: page.goto: net::ERR_SOCKET_NOT_CONNECTED at http://localhost:3000/routines
Call log:
  - navigating to "http://localhost:3000/routines", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - heading "Não é possível acessar esse site" [level=1] [ref=e7]
  - paragraph [ref=e8]:
    - text: A página
    - strong [ref=e9]: http://localhost:3000/routines
    - text: pode estar temporariamente indisponível ou pode ter sido movida permanentemente para um novo endereço da Web.
  - generic [ref=e10]: ERR_SOCKET_NOT_CONNECTED
```

# Test source

```ts
  1  | // @ts-nocheck
  2  | import { test, expect } from '@playwright/test';
  3  | 
  4  | test.describe('Smoke Tests [UE-63] @smoke', () => {
  5  |   test('should load the application @smoke', async ({ page }) => {
  6  |     await page.goto('/');
  7  |     await expect(page).toHaveTitle(/FORJA|Ultra Exercises|Vite/);
  8  |     // rastreabilidade visual: screenshot basica em smoke
  9  |     await expect(page.locator('body')).toBeVisible();
  10 |   });
  11 | 
  12 |   test('should navigate to auth page @smoke', async ({ page }) => {
  13 |     await page.goto('/auth');
  14 |     await expect(page.locator('h1, h2, [data-testid="auth-title"]')).toBeVisible({ timeout: 10_000 });
  15 |     // valida que form de auth renderiza (sem depender de backend)
  16 |     await expect(page.locator('input[type="email"]')).toBeVisible();
  17 |     await expect(page.locator('input[type="password"]')).toBeVisible();
  18 |   });
  19 | 
  20 |   test('should navigate to critical journeys without backend @smoke', async ({ page }) => {
  21 |     // garante que rotas criticas existem mesmo sem backend (redirecionam para /auth)
  22 |     for (const route of ['/routines', '/progress', '/player']) {
> 23 |       await page.goto(route);
     |                  ^ Error: page.goto: net::ERR_SOCKET_NOT_CONNECTED at http://localhost:3000/routines
  24 |       await page.waitForLoadState('networkidle');
  25 |       const url = page.url();
  26 |       expect(url).toMatch(/\/(routines|progress|player|auth)/);
  27 |     }
  28 |   });
  29 | });
  30 | 
  31 | test.describe('Basic Navigation', () => {
  32 |   test('should have working navigation', async ({ page }) => {
  33 |     await page.goto('/');
  34 |     // Basic check that the app loads without console errors
  35 |     const errors: string[] = [];
  36 |     page.on('console', (msg) => {
  37 |       if (msg.type() === 'error') {
  38 |         errors.push(msg.text());
  39 |       }
  40 |     });
  41 |     await page.waitForLoadState('networkidle');
  42 |     // Filter out known non-critical errors
  43 |     const criticalErrors = errors.filter(
  44 |       (e) => !e.includes('favicon') && !e.includes('manifest')
  45 |     );
  46 |     expect(criticalErrors).toHaveLength(0);
  47 |   });
  48 | });
```