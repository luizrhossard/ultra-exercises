import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Tab, UserProfile } from "./types";
import { api } from "./api";

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
  const [profile, setProfile] = useState<UserProfile>(() =>
    load("forja:profile:v1", { name: "", sports: [] as string[], onboarded: false })
  );
  const [tab, setTab] = useState<Tab>("explorar");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [genFocus, setGenFocus] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("forja:token:v1"));
  const [authLoading, setAuthLoading] = useState(Boolean(token));

  useEffect(() => {
    localStorage.setItem("forja:profile:v1", JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    if (!token) { setAuthLoading(false); return; }
    setAuthLoading(true);
    api.me(token).then((remote) => {
      setProfile({ name: remote.name ?? "", sports: remote.sports.map((s) => s.code), onboarded: remote.sports.length > 0 });
    }).catch(() => {
      localStorage.removeItem("forja:token:v1"); setToken(null);
    }).finally(() => setAuthLoading(false));
  }, [token]);

  const toast = useCallback((msg: string, color?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, tone: color ? "sport" : "volt", color }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const authenticate = useCallback(async (mode: "login" | "register", email: string, password: string, name: string) => {
    const response = mode === "login" ? await api.login(email, password) : await api.register(email, password, name);
    localStorage.setItem("forja:token:v1", response.token);
    setToken(response.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("forja:token:v1"); setToken(null);
    setProfile({ name: "", sports: [], onboarded: false }); setTab("explorar");
  }, []);

  const completeOnboarding = useCallback(async (name: string, sports: string[]) => {
    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
    const remote = await api.saveProfile(token, name, sports);
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
