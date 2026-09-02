import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProgressiveList } from "./useProgressiveList";

const ITEMS = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `ex-${i}` }));

beforeEach(() => {
  vi.useRealTimers();
});

describe("useProgressiveList", () => {
  it("renderiza apenas a página inicial, sem montar a lista inteira", () => {
    const { result } = renderHook(() => useProgressiveList(ITEMS, "k", { pageSize: 10, initialCount: 10 }));
    expect(result.current.visible).toHaveLength(10);
    expect(result.current.hasMore).toBe(true);
  });

  it("carrega mais sem duplicar nem pular itens", async () => {
    const { result } = renderHook(() => useProgressiveList(ITEMS, "k", { pageSize: 10, initialCount: 10 }));
    await act(async () => result.current.loadMore());
    expect(result.current.visible).toHaveLength(20);
    expect(result.current.visible[0].id).toBe(0);
    expect(result.current.visible[19].id).toBe(19);
    await act(async () => result.current.loadMore());
    expect(result.current.visible).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
  });

  it("indica o fim da lista quando todos os itens estão visíveis", () => {
    const { result } = renderHook(() => useProgressiveList(ITEMS.slice(0, 5), "k", { pageSize: 10, initialCount: 10 }));
    expect(result.current.hasMore).toBe(false);
    expect(result.current.visible).toHaveLength(5);
  });

  it("reseta para a primeira página quando a lista muda (filtro/busca)", async () => {
    const { result, rerender } = renderHook(
      ({ items, key }) => useProgressiveList(items, key, { pageSize: 10, initialCount: 10 }),
      { initialProps: { items: ITEMS, key: "a" } }
    );
    await act(async () => result.current.loadMore());
    expect(result.current.visible).toHaveLength(20);

    rerender({ items: ITEMS.slice(0, 3), key: "b" });
    expect(result.current.visible).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("trata falha no carregamento incremental com erro + retry", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useProgressiveList(ITEMS, "k", {
        pageSize: 10,
        initialCount: 10,
        minLoadMs: 0,
        onLoadMore: async () => {
          calls++;
          if (calls === 1) throw new Error("rede fora");
        },
      })
    );

    await act(async () => result.current.loadMore());
    expect(result.current.error).toBe(true);
    expect(result.current.visible).toHaveLength(10);

    await act(async () => result.current.retry());
    expect(result.current.error).toBe(false);
    expect(result.current.visible).toHaveLength(20);
  });

  it("mostra estado de carregamento durante o incremento", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useProgressiveList(ITEMS, "k", { pageSize: 10, initialCount: 10, minLoadMs: 500 }));
    act(() => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    await act(async () => vi.advanceTimersByTime(501));
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.visible).toHaveLength(20);
  });
});