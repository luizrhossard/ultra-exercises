import { useCallback, useEffect, useRef, useState } from "react";
import { dedupeFetch, getCached, getCachedOrStale, setCache } from "../cache";

export interface UseCachedQueryOptions<T> {
  /** Chave de isolamento por usuário (hash do token). */
  userKey: string;
  /** Chave lógica do dado (ex.: "readiness/today"). */
  key: string;
  /** Tempo de vida do cache. */
  ttl: number;
  /** Busca na API. */
  fetcher: () => Promise<T>;
  /** Quando false, não busca nem lê o cache. */
  enabled?: boolean;
}

export interface UseCachedQueryResult<T> {
  /** Último dado válido disponível (cache ou rede). */
  data: T | null;
  /** true enquanto não há dado algum e a rede ainda não respondeu. */
  loading: boolean;
  /** true quando a busca falhou e não há cache utilizável. */
  error: boolean;
  /** true quando o dado exibido veio de cache expirado (fallback offline). */
  stale: boolean;
  /** Força revalidação em segundo plano. */
  refresh: () => void;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Stale-while-revalidate: exibe imediatamente o último dado válido em cache,
 * revalida em segundo plano e só atualiza a UI se o valor mudou.
 */
export function useCachedQuery<T>(options: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const { userKey, key, ttl, fetcher, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const revalidate = useCallback(
    (force: boolean) => {
      if (!enabled || !userKey) {
        setData(null);
        setLoading(false);
        setError(false);
        return;
      }
      const fresh = force ? undefined : getCached<T>(userKey, key);
      const fallback = getCachedOrStale<T>(userKey, key);
      if (fresh !== undefined) {
        setData(fresh);
        setStale(false);
        setError(false);
      } else if (fallback !== undefined) {
        setData(fallback.value);
        setStale(fallback.stale);
        setError(false);
      } else {
        // Troca de chave/usuário sem cache: limpa o dado anterior e volta ao estado de carga.
        setData(null);
        setStale(false);
        setError(false);
      }
      setLoading(fresh === undefined && fallback === undefined);
      dedupeFetch(userKey, key, fetcherRef.current)
        .then((remote) => {
          setCache(userKey, key, remote, ttl);
          setData((current) => (sameValue(current, remote) ? current : remote));
          setStale(false);
          setError(false);
        })
        .catch(() => {
          if (fallback === undefined) {
            setError(true);
            setLoading(false);
          }
        });
    },
    [enabled, userKey, key, ttl]
  );

  useEffect(() => {
    // Revalidação SWR no mount e em troca de chave: o seed do cache é síncrono por design
    // (render instantâneo a partir do cache); o fetch em si roda em callbacks assíncronos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    revalidate(false);
  }, [revalidate]);

  return { data, loading, error, stale, refresh: () => revalidate(true) };
}