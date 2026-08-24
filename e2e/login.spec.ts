import { test, expect } from "@playwright/test";
import { mockApi, AUTHED_ROUTES } from "./helpers";

test.describe("fluxo crítico: login", () => {
  test("entra com credenciais válidas e vê o feed autenticado", async ({ page }) => {
    await mockApi(page, {
      ...AUTHED_ROUTES,
      "POST /api/auth/login": {
        body: { mfaRequired: false, token: "e2e-token", email: "ana@x.com" },
      },
    });

    await page.goto("/");

    await page.getByPlaceholder("E-mail").fill("ana@x.com");
    await page.getByPlaceholder(/Senha/).fill("senha-segura-123");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Autenticado: shell principal com o feed explorável
    await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
    await expect(page.getByText("Supino Reto")).toBeVisible();
  });

  test("exibe erro amigável com credenciais inválidas", async ({ page }) => {
    await mockApi(page, {
      "POST /api/auth/login": {
        status: 401,
        body: { error: "INVALID_CREDENTIALS", message: "Credenciais inválidas." },
      },
    });

    await page.goto("/");

    await page.getByPlaceholder("E-mail").fill("ana@x.com");
    await page.getByPlaceholder(/Senha/).fill("errada-12345");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toContainText("Credenciais inválidas.");
    // Permanece na tela de entrada
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });
});
