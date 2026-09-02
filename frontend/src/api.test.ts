import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, request } from "./api";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request — contrato de erro da API", () => {
  it("converte o corpo padronizado em ApiError com código, campos e traceId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(400, {
        timestamp: "2026-08-21T00:00:00Z",
        status: 400,
        error: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        fields: [{ field: "email", message: "Informe um e-mail válido." }],
        traceId: "trace-abc",
      }),
    ));

    const err = (await api.login("x", "y").catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("http");
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Dados inválidos.");
    expect(err.fields?.[0].field).toBe("email");
    expect(err.traceId).toBe("trace-abc");
  });

  it("usa a mensagem do primeiro campo quando não há mensagem geral", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(400, { error: "VALIDATION_ERROR", fields: [{ field: "senha", message: "Senha muito curta." }] }),
    ));

    const err = (await api.register("a@b.com", "12345678", "").catch((e) => e)) as ApiError;

    expect(err.message).toBe("Senha muito curta.");
  });

  it("nunca expõe texto bruto de resposta não-JSON (gateway/proxy)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>nginx 502 Bad Gateway internal-detail</html>", { status: 502 }),
    ));

    const err = (await api.sports().catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).not.toContain("nginx");
    expect(err.message).not.toContain("internal-detail");
    expect(err.message).toBe("Erro interno inesperado. Tente novamente em instantes.");
  });
});

describe("request — classificação de falhas de rede", () => {
  it("classifica TypeError como falha de rede com mensagem amigável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const err = (await api.sports().catch((e) => e)) as ApiError;

    expect(err.kind).toBe("network");
    expect(err.message).toContain("Não foi possível conectar");
  });

  it("classifica aborto do timer como timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")));
        }),
    ));

    const err = (await request("/sports", {}, undefined, { timeoutMs: 15 }).catch((e) => e)) as ApiError;

    expect(err.kind).toBe("timeout");
    expect(err.message).toContain("demorou demais");
  });
});

describe("request — política de retry idempotente", () => {
  it("tenta novamente uma única vez em GET com 503 e recupera", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 1, code: "FUT", name: "Futebol", description: null }]));
    vi.stubGlobal("fetch", fetchMock);

    const sports = await api.sports();

    expect(sports).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não tenta novamente em POST com 503", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const err = (await api.login("a@b.com", "senha").catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("esgota as duas tentativas quando o GET falha de novo", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.sports()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("request — comportamento básico preservado", () => {
  it("retorna undefined em 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await request("/readiness/today", { method: "PUT", body: "{}" }, "token");

    expect(result).toBeUndefined();
  });

  it("anexa Authorization Bearer quando há token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { email: "a@b.com", name: null, sports: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await api.me("meu-token");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer meu-token");
  });
});
