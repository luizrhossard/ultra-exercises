import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CACHE_TTL,
  clearCache,
  dedupeFetch,
  getCached,
  getCachedOrStale,
  invalidate,
  setCache,
  userCacheKey,
} from "./cache";

beforeEach(() => {
  localStorage.clear();
  clearCache();
});

describe("userCacheKey", () => {
  it("isola usuários diferentes e é estável por token", () => {
    const a = userCacheKey("token-do-usuario-a");
    const b = userCacheKey("token-do-usuario-b");
    expect(a).not.toBe(b);
    expect(userCacheKey("token-do-usuario-a")).toBe(a);
  });

  it("não persiste o token", () => {
    setCache("u1", "me", { nome: "x" }, CACHE_TTL.profile);
    const raw = localStorage.getItem(localStorage.key(0) as string) as string;
    expect(raw).not.toContain("token-do-usuario");
  });
});

describe("cache hit / miss", () => {
  it("retorna undefined em cache miss", () => {
    expect(getCached("u1", "routines")).toBeUndefined();
  });

  it("retorna o valor em cache hit antes da expiração", () => {
    setCache("u1", "routines", [{ id: 1 }], CACHE_TTL.routines);
    expect(getCached("u1", "routines")).toEqual([{ id: 1 }]);
  });

  it("expira após o TTL e volta a buscar na rede", () => {
    vi.useFakeTimers();
    setCache("u1", "routines", [{ id: 1 }], CACHE_TTL.routines);
    vi.advanceTimersByTime(CACHE_TTL.routines + 1);
    expect(getCached("u1", "routines")).toBeUndefined();
    vi.useRealTimers();
  });

  it("getCachedOrStale devolve o valor expirado marcado como stale (fallback)", () => {
    vi.useFakeTimers();
    setCache("u1", "routines", [{ id: 1 }], 1000);
    vi.advanceTimersByTime(1001);
    const stale = getCachedOrStale("u1", "routines");
    expect(stale?.value).toEqual([{ id: 1 }]);
    expect(stale?.stale).toBe(true);
    vi.useRealTimers();
  });
});

describe("invalidação por mutação", () => {
  it("remove apenas as entradas do usuário que casam com o padrão", () => {
    setCache("u1", "routines", [1], CACHE_TTL.routines);
    setCache("u1", "sports", [1], CACHE_TTL.sports);
    setCache("u2", "routines", [2], CACHE_TTL.routines);

    invalidate("u1", /routines/);

    expect(getCached("u1", "routines")).toBeUndefined();
    expect(getCached("u1", "sports")).toEqual([1]);
    expect(getCached("u2", "routines")).toEqual([2]);
  });
});

describe("limpeza no logout", () => {
  it("clearCache remove memória e localStorage de todos os usuários", () => {
    setCache("u1", "routines", [1], CACHE_TTL.routines);
    setCache("u2", "me", [2], CACHE_TTL.profile);

    clearCache();

    expect(getCached("u1", "routines")).toBeUndefined();
    expect(getCached("u2", "me")).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });
});

describe("dedupeFetch", () => {
  it("deduplica requisições idênticas em voo", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const p1 = dedupeFetch("u1", "routines", fetcher);
    const p2 = dedupeFetch("u1", "routines", fetcher);
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("não deduplica chaves diferentes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await Promise.all([
      dedupeFetch("u1", "routines", fetcher),
      dedupeFetch("u1", "sports", fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});