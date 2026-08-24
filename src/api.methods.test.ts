import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api, request, ApiError } from "./api";

const fetchMock = vi.fn();

function res(body: unknown, init: { status?: number; ok?: boolean; text?: string } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    text: async () => init.text ?? JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(res({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api — wrappers batem no endpoint certo", () => {
  const cases: { name: string; call: () => Promise<unknown>; token?: string; method?: string; path: string; body?: unknown }[] = [
    { name: "login", call: () => api.login("a@b.c", "senha"), method: "POST", path: "/auth/login", body: { email: "a@b.c", password: "senha" } },
    { name: "verifyTwoFactor", call: () => api.verifyTwoFactor("chal", "123456"), method: "POST", path: "/auth/2fa/verify", body: { challengeToken: "chal", code: "123456" } },
    { name: "register", call: () => api.register("a@b.c", "senha", "Ana"), method: "POST", path: "/auth/register", body: { email: "a@b.c", password: "senha", name: "Ana" } },
    { name: "me", call: () => api.me("tok"), token: "tok", path: "/me" },
    { name: "saveProfile", call: () => api.saveProfile("tok", "Ana", ["futebol"]), token: "tok", method: "PUT", path: "/me", body: { name: "Ana", sports: [{ code: "futebol", level: "COMPETITIVE" }] } },
    { name: "todayReadiness", call: () => api.todayReadiness("tok"), token: "tok", path: "/readiness/today" },
    { name: "saveReadiness", call: () => api.saveReadiness("tok", { sleepQuality: 3, fatigue: 3, stress: 3, soreness: 3, painArea: "", painLevel: 0, notes: "" }), token: "tok", method: "PUT", path: "/readiness/today" },
    { name: "sports", call: () => api.sports(), path: "/sports" },
    { name: "exercisesFeed com filtros", call: () => api.exercisesFeed([1, 2], "supino", "Força"), path: "/exercises/feed?sportIds=1&sportIds=2&q=supino&category=For%C3%A7a" },
    { name: "routines", call: () => api.routines("tok"), token: "tok", path: "/routines" },
    { name: "generateRoutine", call: () => api.generateRoutine("tok", 7), token: "tok", method: "POST", path: "/routines/generate", body: { sportId: 7 } },
    { name: "createSession", call: () => api.createSession("tok", 7), token: "tok", method: "POST", path: "/routines/7/sessions" },
    { name: "startSession", call: () => api.startSession("tok", 9), token: "tok", method: "POST", path: "/sessions/9/start" },
    { name: "patchSession", call: () => api.patchSession("tok", 9, { status: "COMPLETED" }), token: "tok", method: "PATCH", path: "/sessions/9", body: { status: "COMPLETED" } },
    { name: "patchSessionItem", call: () => api.patchSessionItem("tok", 9, 3, { completedSets: 4 }), token: "tok", method: "PATCH", path: "/sessions/9/items/3", body: { completedSets: 4 } },
    { name: "progressSessions com filtros", call: () => api.progressSessions("tok", 0, 20, { q: "terra", intensity: "ALTA", from: "2026-01-01" }), token: "tok", path: "/progress/sessions?page=0&size=20&q=terra&intensity=ALTA&from=2026-01-01" },
    { name: "progressHistoryExercises", call: () => api.progressHistoryExercises("tok"), token: "tok", path: "/progress/history-exercises" },
    { name: "progressHistoryStats com filtros", call: () => api.progressHistoryStats("tok", { muscle: "core" }), token: "tok", path: "/progress/history-stats?muscle=core" },
    { name: "exerciseEvolution", call: () => api.exerciseEvolution("tok", 5), token: "tok", path: "/progress/exercise-evolution?exerciseId=5&months=6" },
    { name: "volumeTrend", call: () => api.volumeTrend("tok", "week"), token: "tok", path: "/progress/volume-trend?granularity=week&months=6" },
    { name: "performanceComparison", call: () => api.performanceComparison("tok"), token: "tok", path: "/progress/performance-comparison?days=30" },
    { name: "generateShareLink", call: () => api.generateShareLink("tok", 7), token: "tok", method: "POST", path: "/routines/7/share" },
    { name: "sharedRoutine", call: () => api.sharedRoutine("abc/123"), path: "/share/abc%2F123" },
    { name: "alerts", call: () => api.alerts("tok"), token: "tok", path: "/alerts" },
    { name: "updateAlertSettings", call: () => api.updateAlertSettings("tok", { enabled: true }), token: "tok", method: "PUT", path: "/alerts/settings", body: { enabled: true } },
    { name: "progressWeeklySummary", call: () => api.progressWeeklySummary("tok"), token: "tok", path: "/progress/weekly-summary" },
    { name: "progressReadinessTrend", call: () => api.progressReadinessTrend("tok", 30), token: "tok", path: "/progress/readiness-trend?days=30" },
    { name: "twoFactorStatus", call: () => api.twoFactorStatus("tok"), token: "tok", path: "/me/2fa/status" },
    { name: "setupTwoFactor", call: () => api.setupTwoFactor("tok"), token: "tok", method: "POST", path: "/me/2fa/setup" },
    { name: "activateTwoFactor", call: () => api.activateTwoFactor("tok", "123456"), token: "tok", method: "POST", path: "/me/2fa/activate", body: { code: "123456" } },
    { name: "regenerateRecoveryCodes", call: () => api.regenerateRecoveryCodes("tok", "senha", "123456"), token: "tok", method: "POST", path: "/me/2fa/recovery-codes", body: { password: "senha", code: "123456" } },
    { name: "disableTwoFactor", call: () => api.disableTwoFactor("tok", "senha", "123456"), token: "tok", method: "POST", path: "/me/2fa/disable", body: { password: "senha", code: "123456" } },
  ];

  it.each(cases)("$name", async ({ call, token, method, path, body }) => {
    await call();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(path);
    expect((options as RequestInit).method ?? "GET").toBe(method ?? "GET");
    if (body !== undefined) expect(JSON.parse((options as RequestInit).body as string)).toEqual(body);
    if (token) expect((options as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${token}` });
  });
});

describe("request — timeout, retry e contratos de erro", () => {
  it("retorna undefined em resposta 204 sem parsear JSON", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => "", json: async () => { throw new Error("não deveria parsear"); } });
    await expect(api.disableTwoFactor("tok", "s", "123456")).resolves.toBeUndefined();
  });

  it("classifica aborto como timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("abort", "AbortError"));
    const err = await request("/lento").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("timeout");
  });

  it("tenta novamente em GET com falha de rede e depois sucesso", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("conexão caiu"))
      .mockResolvedValueOnce(res({ ok: true }));
    await expect(request("/feed")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não tenta novamente em POST com falha de rede", async () => {
    fetchMock.mockRejectedValue(new TypeError("conexão caiu"));
    const err = await request("/acao", { method: "POST" }).catch((e) => e);
    expect((err as ApiError).kind).toBe("network");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tenta novamente em GET com 503 e desiste após a segunda falha", async () => {
    fetchMock.mockResolvedValue(res({}, { status: 503 }));
    const err = await request("/instavel").catch((e) => e);
    expect((err as ApiError).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("usa mensagem genérica para corpo de erro não-JSON (gateway)", async () => {
    fetchMock.mockResolvedValue(res(undefined, { status: 500, text: "<html>gateway</html>" }));
    const err = await request("/quebrado").catch((e) => e);
    expect((err as ApiError).message).toBe("Erro interno inesperado. Tente novamente em instantes.");
  });

  it("propaga código, campos e traceId do contrato de erro JSON", async () => {
    fetchMock.mockResolvedValue(
      res(
        { error: "VALIDATION", message: "Dados inválidos.", fields: [{ field: "email", message: "E-mail inválido" }], traceId: "tr-1" },
        { status: 400 }
      )
    );
    const err = await request("/registro", { method: "POST" }).catch((e) => e);
    expect((err as ApiError).message).toBe("Dados inválidos.");
    expect((err as ApiError).code).toBe("VALIDATION");
    expect((err as ApiError).fields).toEqual([{ field: "email", message: "E-mail inválido" }]);
    expect((err as ApiError).traceId).toBe("tr-1");
  });

  it("usa a primeira mensagem de campo quando o corpo não tem message", async () => {
    fetchMock.mockResolvedValue(
      res({ error: "VALIDATION", fields: [{ field: "senha", message: "Mínimo de 8 caracteres" }] }, { status: 400 })
    );
    const err = await request("/registro", { method: "POST" }).catch((e) => e);
    expect((err as ApiError).message).toBe("Mínimo de 8 caracteres");
  });

  it("mensagem genérica para status 4xx fora da tabela", async () => {
    fetchMock.mockResolvedValue(res(undefined, { status: 418, text: "" }));
    const err = await request("/chaleira").catch((e) => e);
    expect((err as ApiError).message).toBe("Algo deu errado. Tente novamente.");
  });

  it("mensagem específica para 401, 404 e 429", async () => {
    for (const [status, fragment] of [
      [401, "Não foi possível autenticar"],
      [404, "Recurso não encontrado"],
      [429, "Muitas tentativas"],
    ] as const) {
      fetchMock.mockResolvedValue(res(undefined, { status, text: "" }));
      const err = await request(`/x-${status}`).catch((e) => e);
      expect((err as ApiError).message).toContain(fragment);
    }
  });
});
