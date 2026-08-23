/**
 * Cache leve de leitura para dados frequentes.
 *
 * Estratégia: stale-while-revalidate com TTL por tipo de dado, isolamento por
 * usuário (chave derivada do token — o token em si nunca é armazenado aqui) e
 * deduplicação de requisições idênticas em voo. Persistência em localStorage
 * com espelho em memória. Nada de credenciais, senhas ou dados sensíveis.
 */

const PREFIX = "forja:cache:v1";

export const CACHE_TTL = {
  /** Perfil do usuário (GET /me). */
  profile: 5 * 60_000,
  /** Catálogo de esportes — muda raramente. */
  sports: 24 * 60 * 60_000,
  /** Feed de exercícios ranqueado por esportes — catálogo muda raramente. */
  feed: 24 * 60 * 60_000,
  /** Lista de rotinas do usuário. */
  routines: 2 * 60_000,
  /** Check-in de prontidão do dia. */
  readiness: 2 * 60_000,
  /** Dados de progresso (resumo semanal e tendência de prontidão). */
  progress: 60_000,
} as const;

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

function storageKey(userKey: string, key: string): string {
  return `${PREFIX}:${userKey}:${key}`;
}

/** Chave de isolamento por usuário: hash do token (o token não é persistido). */
export function userCacheKey(token: string): string {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash + token.charCodeAt(i)) | 0;
  }
  return `u${(hash >>> 0).toString(36)}`;
}

export function getCached<T>(userKey: string, key: string): T | undefined {
  const entry = readEntry<T>(userKey, key);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.value;
}

/** Retorna o valor mesmo expirado, para uso como fallback (stale-while-revalidate). */
export function getCachedOrStale<T>(userKey: string, key: string): { value: T; stale: boolean } | undefined {
  const entry = readEntry<T>(userKey, key);
  if (!entry) return undefined;
  return { value: entry.value, stale: entry.expiresAt <= Date.now() };
}

export function setCache<T>(userKey: string, key: string, value: T, ttl: number): void {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttl };
  const k = storageKey(userKey, key);
  memory.set(k, entry as CacheEntry<unknown>);
  try {
    localStorage.setItem(k, JSON.stringify(entry));
  } catch {
    // localStorage cheio ou indisponível: mantém apenas em memória.
  }
}

/** Remove entradas do usuário cuja chave casa com o padrão (ex.: após mutação). */
export function invalidate(userKey: string, pattern: RegExp): void {
  const match = (k: string) => k.startsWith(PREFIX) && k.includes(`:${userKey}:`) && pattern.test(k);
  for (const k of [...memory.keys()]) {
    if (match(k)) memory.delete(k);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && match(k)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

/** Limpeza total (logout / troca de conta). Remove memória e localStorage. */
export function clearCache(): void {
  memory.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

function readEntry<T>(userKey: string, key: string): CacheEntry<T> | undefined {
  const k = storageKey(userKey, key);
  const mem = memory.get(k);
  if (mem) return mem as CacheEntry<T>;
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      memory.set(k, parsed as CacheEntry<unknown>);
      return parsed;
    }
  } catch {
    // entrada corrompida: ignora e remove
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
  return undefined;
}

/** Deduplicação: requisições idênticas em voo compartilham a mesma promise. */
const inFlight = new Map<string, Promise<unknown>>();

export function dedupeFetch<T>(userKey: string, key: string, fetcher: () => Promise<T>): Promise<T> {
  const k = `${userKey}:${key}`;
  const existing = inFlight.get(k);
  if (existing) return existing as Promise<T>;
  const promise = fetcher().finally(() => inFlight.delete(k));
  inFlight.set(k, promise);
  return promise;
}