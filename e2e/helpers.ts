import type { Page, Route } from "@playwright/test";

/**
 * Fluxos E2E com API mockada via page.route: determinísticos, sem backend nem
 * banco — o objetivo é validar os fluxos críticos da UI de ponta a ponta.
 */

export const SPORT = { id: 1, code: "futebol", name: "Futebol", description: null };

export const ROUTINE = {
  id: 7,
  name: "Treino A — Peito",
  sportCode: "futebol",
  sportName: "Futebol",
  createdAt: "2026-08-24T10:00:00Z",
  items: [
    { exerciseId: 1, exerciseName: "Supino", position: 0, sets: 4, reps: "8", restTime: 90 },
  ],
};

export const PLANNED_SESSION = {
  id: 8,
  routineId: 7,
  routineName: "Treino A — Peito",
  sportCode: "futebol",
  sportName: "Futebol",
  status: "PLANNED",
  scheduledAt: "2026-08-24T10:00:00Z",
  startedAt: null,
  completedAt: null,
  durationMinutes: null,
  sessionRpe: null,
  notes: null,
  items: [],
};

export const ACTIVE_SESSION = {
  ...PLANNED_SESSION,
  id: 9,
  status: "IN_PROGRESS",
  startedAt: "2026-08-24T10:05:00Z",
  items: [
    {
      exerciseId: 1,
      exerciseName: "Supino",
      position: 0,
      prescribedSets: 4,
      prescribedReps: "8",
      prescribedRestTime: 90,
      completedSets: null,
      completedReps: null,
      loadKg: null,
      itemRpe: null,
      painLevel: null,
      notes: null,
    },
  ],
};

export const FEED_ITEM = {
  exerciseId: 999,
  name: "Supino Reto",
  category: "FORCA",
  equipment: "Barra",
  muscles: ["peitoral"],
  bestScore: 5,
  strongCount: 3,
  scoreBySport: { futebol: 4 },
  rationaleBySport: { futebol: "Força de empurre." },
};

type MockResponse = { status?: number; body: unknown };

/** Intercepta chamadas à API (http://localhost:8085/api) com um mapa método+caminho. */
export async function mockApi(
  page: Page,
  handlers: Record<string, MockResponse | ((route: Route) => Promise<void>)>
) {
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const key = `${req.method()} ${new URL(req.url()).pathname}`;
    const hit = handlers[key];
    if (!hit) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }
    if (typeof hit === "function") {
      await hit(route);
      return;
    }
    await route.fulfill({
      status: hit.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(hit.body),
    });
  });
}

/** Sessão autenticada pronta (perfil onboarded) antes do carregamento da página. */
export async function seedAuthenticated(page: Page, token = "e2e-token") {
  await page.addInitScript(
    ([t]) => {
      localStorage.setItem("forja:token:v1", t as string);
      localStorage.setItem(
        "forja:profile:v1",
        JSON.stringify({ name: "Ana", sports: ["futebol"], onboarded: true })
      );
    },
    [token]
  );
}

export const AUTHED_ROUTES: Record<string, MockResponse> = {
  "GET /api/me": {
    body: { email: "ana@x.com", name: "Ana", sports: [{ code: "futebol", name: "Futebol", level: "COMPETITIVE" }] },
  },
  "GET /api/sports": { body: [SPORT] },
  "GET /api/exercises/feed": { body: [FEED_ITEM] },
  "GET /api/readiness/today": { body: null },
};
