import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCachedQuery } from "./useCachedQuery";
import { clearCache, setCache, CACHE_TTL } from "../cache";

beforeEach(() => {
  localStorage.clear();
  clearCache();
});

const opts = (overrides: Partial<Parameters<typeof useCachedQuery<number>>[0]> = {}) => ({
  userKey: "u1",
  key: "profile",
  ttl: CACHE_TTL.profile,
  fetcher: vi.fn().mockResolvedValue(42),
  enabled: true,
  ...overrides,
});

describe("useCachedQuery", () => {
  it("cache miss: busca na rede e popular o cache", async () => {
    const { result } = renderHook(() => useCachedQuery(opts()));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.error).toBe(false);
    expect(getCachedValue()).toBe(42);
  });

  it("cache hit: exibe imediatamente e revalida em segundo plano", async () => {
    setCache("u1", "profile", 7, CACHE_TTL.profile);
    const options = opts();
    const { result } = renderHook(() => useCachedQuery(options));
    expect(result.current.data).toBe(7);
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(options.fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.data).toBe(42));
  });

  it("expiração: dado expirado vira fallback stale enquanto revalida", async () => {
    vi.useFakeTimers();
    setCache("u1", "profile", 7, 1000);
    await vi.advanceTimersByTimeAsync(1001);
    let resolveFetch: (v: number) => void = () => {};
    const fetcher = vi.fn().mockImplementation(
      () => new Promise<number>((resolve) => { resolveFetch = resolve; })
    );
    const { result } = renderHook(() => useCachedQuery(opts({ fetcher })));
    expect(result.current.stale).toBe(true);
    expect(result.current.data).toBe(7);
    expect(result.current.loading).toBe(false);
    await act(async () => {
      resolveFetch(42);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.stale).toBe(false);
    expect(result.current.data).toBe(42);
    vi.useRealTimers();
  });

  it("falha de rede sem cache: expõe erro e nenhum dado", async () => {
    const options = opts({ fetcher: vi.fn().mockRejectedValue(new Error("rede fora")) });
    const { result } = renderHook(() => useCachedQuery(options));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("falha de rede com cache válido: usa o último dado (stale-while-revalidate)", async () => {
    setCache("u1", "profile", 7, CACHE_TTL.profile);
    const options = opts({ fetcher: vi.fn().mockRejectedValue(new Error("rede fora")) });
    const { result } = renderHook(() => useCachedQuery(options));
    await waitFor(() => expect(options.fetcher).toHaveBeenCalled());
    expect(result.current.data).toBe(7);
    expect(result.current.error).toBe(false);
  });

  it("isola dados por usuário", async () => {
    setCache("u1", "profile", 1, CACHE_TTL.profile);
    setCache("u2", "profile", 2, CACHE_TTL.profile);
    const { result } = renderHook(() =>
      useCachedQuery(opts({ userKey: "u2", fetcher: vi.fn().mockResolvedValue(99) }))
    );
    expect(result.current.data).toBe(2);
    await waitFor(() => expect(result.current.data).toBe(99));
    expect(getCachedValueFor("u1")).toBe(1);
  });

  it("refresh() força revalidação mesmo com cache fresco", async () => {
    setCache("u1", "profile", 7, CACHE_TTL.profile);
    const options = opts();
    const { result } = renderHook(() => useCachedQuery(options));
    await waitFor(() => expect(options.fetcher).toHaveBeenCalledTimes(1));
    expect(result.current.data).toBe(42);
    await act(async () => result.current.refresh());
    expect(options.fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(42);
  });

  it("não atualiza a UI se o valor revalidado for idêntico", async () => {
    setCache("u1", "profile", 42, CACHE_TTL.profile);
    const options = opts();
    const { result } = renderHook(() => useCachedQuery(options));
    await waitFor(() => expect(result.current.data).toBe(42));
    const dataAfterCache = result.current.data;
    await waitFor(() => expect(options.fetcher).toHaveBeenCalledTimes(1));
    // Valor idêntico na revalidação não muda o dado exibido nem deixa loading pendente.
    expect(result.current.data).toBe(dataAfterCache);
    expect(result.current.loading).toBe(false);
  });
});

function getCachedValue(): unknown {
  return getValueFor("u1");
}

function getCachedValueFor(user: string): unknown {
  return getValueFor(user);
}

function getValueFor(user: string): unknown {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) as string;
    if (k.includes(`:${user}:profile`)) {
      return JSON.parse(localStorage.getItem(k) as string).value;
    }
  }
  return undefined;
}