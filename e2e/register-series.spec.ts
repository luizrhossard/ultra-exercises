import { test, expect } from "@playwright/test";
import { mockApi, seedAuthenticated, AUTHED_ROUTES, ROUTINE, PLANNED_SESSION, ACTIVE_SESSION } from "./helpers";

test.describe("fluxo crítico: registrar série", () => {
  test("inicia a sessão da rotina, registra carga da série e conclui", async ({ page }) => {
    await seedAuthenticated(page);
    await mockApi(page, {
      ...AUTHED_ROUTES,
      "GET /api/routines": { body: [ROUTINE] },
      "POST /api/routines/7/sessions": { body: PLANNED_SESSION },
      "POST /api/sessions/8/start": { body: ACTIVE_SESSION },
      "PATCH /api/sessions/9/items/1": { body: ACTIVE_SESSION },
      "PATCH /api/sessions/9": { body: { ...ACTIVE_SESSION, status: "COMPLETED" } },
    });

    await page.goto("/");

    // Aba Rotinas e expande o cartão da rotina
    await page.getByRole("button", { name: "Rotinas" }).first().click();
    await expect(page.getByText(ROUTINE.name)).toBeVisible();
    await page.getByText(ROUTINE.name).click();

    // Inicia a sessão
    await page.getByRole("button", { name: /Iniciar sessão/ }).click();
    await expect(page.getByText("Executando · Futebol")).toBeVisible();
    await expect(page.getByText("Prescrito: 4 × 8")).toBeVisible();

    // Registra a série executada com carga
    const carga = page.getByLabel("Carga kg");
    await carga.fill("50");
    await page.getByRole("button", { name: "Registrar exercício" }).click();
    await expect(page.getByText("Exercício registrado.")).toBeVisible();

    // Conclui a sessão
    await page.getByRole("button", { name: /Concluir sessão/ }).click();
    await expect(page.getByText("Sessão concluída e salva.")).toBeVisible();
    await expect(page.getByText("Executando · Futebol")).not.toBeVisible();
  });
});
