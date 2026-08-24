import { test, expect } from "@playwright/test";
import { mockApi, seedAuthenticated, AUTHED_ROUTES, SPORT, ROUTINE } from "./helpers";

test.describe("fluxo crítico: criar treino", () => {
  test("gera uma rotina para o esporte em foco e a lista em Prescritas", async ({ page }) => {
    let routines: unknown[] = [];

    await seedAuthenticated(page);
    await mockApi(page, {
      ...AUTHED_ROUTES,
      "POST /api/routines/generate": {
        body: ROUTINE,
      },
      "GET /api/routines": {
        body: routines,
      },
    });

    // Estado dinâmico: após gerar, a lista passa a conter a rotina criada.
    await page.unroute("**/api/**");
    routines = [];
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();

      if (method === "POST" && path.endsWith("/routines/generate")) {
        routines = [ROUTINE];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ROUTINE) });
        return;
      }
      if (path.endsWith("/api/routines")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(routines) });
        return;
      }

      const key = `${method} ${path}`;
      const hit = (AUTHED_ROUTES as Record<string, { body: unknown }>)[key];
      if (hit) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hit.body) });
        return;
      }
      if (path.endsWith("/api/readiness/today")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    });

    await page.goto("/");

    // Navega para a aba Rotinas
    await page.getByRole("button", { name: "Rotinas" }).first().click();
    await expect(page.getByRole("heading", { name: "Rotinas" })).toBeVisible();
    await expect(page.getByText("Gere sua primeira rotina acima.")).toBeVisible();

    // Gera o treino do dia
    await page.getByRole("button", { name: /Gerar para Futebol/ }).click();

    // A rotina gerada aparece prescrita
    await expect(page.getByText(ROUTINE.name)).toBeVisible();
    await expect(page.getByText(/1 exercícios/)).toBeVisible();
    void SPORT;
  });
});
