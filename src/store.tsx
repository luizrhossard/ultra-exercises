import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Tab, UserProfile } from "./types";
import { api, type AthleteProfile } from "./api";
import { CACHE_TTL, clearCache, dedupeFetch, getCachedOrStale, invalidate, setCache, userCacheKey } from "./cache";

export interface Toast {
  id: number;
  msg: string;
  tone: "volt" | "sport";
  color?: string;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface AppStore {
  token: string | null;
  authLoading: boolean;
  profile: UserProfile;
  tab: Tab;
  playerId: string | null;
  toasts: Toast[];
  genFocus: string | null;
  setGenFocus: (s: string | null) => void;
  setTab: (t: Tab) => void;
  openPlayer: (id: string) => void;
  closePlayer: () => void;
  toast: (msg: string, color?: string) => void;
  authenticate: (mode: "login" | "register", email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  completeOnboarding: (name: string, sports: string[]) => Promise<void>;
  setName: (n: string) => void;
  toggleSport: (id: string) => void;
  resetAll: () => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const local = load("forja:profile:v1", { name: "", sports: [] as string[], onboarded: false });
    const token = localStorage.getItem("forja:token:v1");
    if (token) {
      const cached = getCachedOrStale<AthleteProfile>(userCacheKey(token), "me");
      if (cached) {
        return { name: cached.value.name ?? "", sports: cached.value.sports.map((s) => s.code), onboarded: cached.value.sports.length > 0 };
      }
    }
    return local;
  });
  const [tab, setTab] = useState<Tab>("explorar");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [genFocus, setGenFocus] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("forja:token:v1"));
  const [authLoading, setAuthLoading] = useState(() => {
    const stored = localStorage.getItem("forja:token:v1");
    return stored ? !getCachedOrStale<AthleteProfile>(userCacheKey(stored), "me") : false;
  });

  useEffect(() => {
    localStorage.setItem("forja:profile:v1", JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    if (!token) return;
    const userKey = userCacheKey(token);
    dedupeFetch(userKey, "me", () => api.me(token)).then((remote) => {
      setCache(userKey, "me", remote, CACHE_TTL.profile);
      setProfile({ name: remote.name ?? "", sports: remote.sports.map((s) => s.code), onboarded: remote.sports.length > 0 });
    }).catch(() => {
      if (!getCachedOrStale<AthleteProfile>(userKey, "me")) {
        localStorage.removeItem("forja:token:v1"); setToken(null);
      }
    }).finally(() => setAuthLoading(false));
  }, [token]);

  const toast = useCallback((msg: string, color?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, tone: color ? "sport" : "volt", color }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const authenticate = useCallback(async (mode: "login" | "register", email: string, password: string, name: string) => {
    const response = mode === "login" ? await api.login(email, password) : await api.register(email, password, name);
    clearCache();
    setAuthLoading(true);
    localStorage.setItem("forja:token:v1", response.token);
    setToken(response.token);
  }, []);

  const logout = useCallback(() => {
    clearCache();
    localStorage.removeItem("forja:token:v1"); setToken(null);
    setAuthLoading(false);
    setProfile({ name: "", sports: [], onboarded: false }); setTab("explorar");
  }, []);

  const completeOnboarding = useCallback(async (name: string, sports: string[]) => {
    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
    const remote = await api.saveProfile(token, name, sports);
    const userKey = userCacheKey(token);
    invalidate(userKey, /me/);
    setCache(userKey, "me", remote, CACHE_TTL.profile);
    setProfile({ name: remote.name ?? "", sports: remote.sports.map((s) => s.code), onboarded: true });
    setTab("explorar");
  }, [token]);

  const setName = useCallback((n: string) => setProfile((p) => ({ ...p, name: n })), []);

  const toggleSport = useCallback((id: string) => {
    setProfile((p) => {
      const has = p.sports.includes(id);
      if (has && p.sports.length === 1) return p;
      return { ...p, sports: has ? p.sports.filter((s) => s !== id) : [...p.sports, id] };
    });
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem("forja:profile:v1");
    setProfile({ name: "", sports: [], onboarded: false });
    setTab("explorar");
    setPlayerId(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        profile,
        token,
        authLoading,
        tab,
        playerId,
        toasts,
        genFocus,
        setGenFocus,
        setTab,
        openPlayer: setPlayerId,
        closePlayer: () => setPlayerId(null),
        toast,
        authenticate,
        logout,
        completeOnboarding,
        setName,
        toggleSport,
        resetAll,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp fora do AppProvider");
  return ctx;
}
