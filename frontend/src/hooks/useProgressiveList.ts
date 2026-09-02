import { useEffect, useRef, useState } from "react";

export interface ProgressiveListOptions {
  /** Quantos itens são adicionados por carregamento. */
  pageSize?: number;
  /** Quantidade inicial renderizada no DOM. */
  initialCount?: number;
  /** Duração mínima do estado "carregando mais" para feedback visual (skeleton), em ms. */
  minLoadMs?: number;
  /** Gancho assíncrono executado antes de revelar a próxima página (ex.: busca na API). Pode lançar erro. */
  onLoadMore?: (nextCount: number) => Promise<void> | void;
}

/**
 * Renderização incremental de listas: monta apenas um subconjunto dos itens e
 * expande sob demanda (sentinel com IntersectionObserver ou botão "Carregar mais").
 * Reseta automaticamente quando a lista muda (filtro/busca) e trata falha + retry.
 */
export function useProgressiveList<T>(
  items: readonly T[],
  listKey: string,
  options: ProgressiveListOptions = {}
) {
  const { pageSize = 12, initialCount = 12, minLoadMs = 0, onLoadMore } = options;
  const [count, setCount] = useState(initialCount);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);
  const loadVersion = useRef(0);
  const [prevKey, setPrevKey] = useState(listKey);

  if (prevKey !== listKey) {
    setPrevKey(listKey);
    setCount(initialCount);
    setLoadingMore(false);
    setError(false);
  }

  const hasMore = count < items.length;
  const visible = items.slice(0, count);

  const loadMore = () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    setError(false);
    const version = ++loadVersion.current;
    const nextCount = Math.min(count + pageSize, items.length);
    const finish = () => {
      if (version !== loadVersion.current) return;
      busy.current = false;
      setLoadingMore(false);
    };
    (async () => {
      if (minLoadMs > 0) await new Promise((resolve) => window.setTimeout(resolve, minLoadMs));
      await onLoadMore?.(nextCount);
      if (version !== loadVersion.current) return;
      setCount(nextCount);
    })().then(finish, () => {
      if (version !== loadVersion.current) return;
      setError(true);
      finish();
    });
  };

  const retry = () => {
    setError(false);
    loadMore();
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, items, listKey]);

  return { visible, hasMore, loadingMore, error, loadMore, retry, sentinelRef };
}