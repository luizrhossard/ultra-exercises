import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Category, Routine, RoutineItem, Tab, UserProfile } from "./types";
import { v4 as uuidv4 } from "uuid";
import { EXERCISES } from "./data/exercises";
import { sportById } from "./data/sports";

export interface Toast {
  id: number;
  msg: string;
  tone: "volt" | "sport";
  color?: string;
}

const DEFAULTS: Record<Category, { sets: number; reps: string; rest: number }> = {
  "Força": { sets: 4, reps: "8 reps", rest: 120 },
  Pliometria: { sets: 4, reps: "6 reps", rest: 90 },
  Core: { sets: 3, reps: "40 s", rest: 45 },
  Condicionamento: { sets: 5, reps: "30 s", rest: 60 },
  Mobilidade: { sets: 2, reps: "45 s", rest: 30 },
  "Específico": { sets: 3, reps: "3 min", rest: 90 },
};

export function generateRoutine(sportId: string, userSports: string[]): Routine {
  const scored = EXERCISES.map((ex) => {
    const focus = ex.links.find((l) => l.sport === sportId)?.score ?? 0;
    const others = Math.max(
      0,
      ...ex.links
        .filter((l) => l.sport !== sportId && userSports.includes(l.sport))
        .map((l) => l.score)
    );
    return { ex, focus, total: focus * 2 + others };
  })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total || b.focus - a.focus);

  const want: [Category, number][] = [
    ["Força", 2],
    ["Pliometria", 1],
    ["Core", 1],
    ["Condicionamento", 1],
    ["Específico", 1],
    ["Mobilidade", 1],
  ];

  const picked: typeof scored = [];
  const used = new Set<string>();
  for (const [cat, n] of want) {
    let taken = 0;
    for (const s of scored) {
      if (taken >= n) break;
      if (!used.has(s.ex.id) && s.ex.category === cat) {
        picked.push(s);
        used.add(s.ex.id);
        taken++;
      }
    }
  }
  for (const s of scored) {
    if (picked.length >= 6) break;
    if (!used.has(s.ex.id)) {
      picked.push(s);
      used.add(s.ex.id);
    }
  }

  const items: RoutineItem[] = picked.map(({ ex, focus }) => {
    const d = DEFAULTS[ex.category];
    return {
      exerciseId: ex.id,
      sets: Math.min(5, d.sets + (focus >= 5 ? 1 : 0)),
      reps: d.reps,
      rest: d.rest,
    };
  });

  const dt = new Date();
  const day = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  return {
    id: uuidv4(),
    name: `Treino ${sportById(sportId).name} · ${day}`,
    sportId,
    createdAt: Date.now(),
    items,
  };
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
  profile: UserProfile;
  routines: Routine[];
  tab: Tab;
  playerId: string | null;
  addFor: string | null;
  toasts: Toast[];
  genFocus: string | null;
  setGenFocus: (s: string | null) => void;
  setTab: (t: Tab) => void;
  openPlayer: (id: string) => void;
  closePlayer: () => void;
  openAdd: (id: string) => void;
  closeAdd: () => void;
  toast: (msg: string, color?: string) => void;
  completeOnboarding: (name: string, sports: string[]) => void;
  setName: (n: string) => void;
  toggleSport: (id: string) => void;
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  updateItem: (routineId: string, exerciseId: string, patch: Partial<RoutineItem>) => void;
  removeItem: (routineId: string, exerciseId: string) => void;
  addToRoutine: (routineId: string, exerciseId: string) => void;
  resetAll: () => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(() =>
    load("forja:profile:v1", { name: "", sports: [] as string[], onboarded: false })
  );
  const [routines, setRoutines] = useState<Routine[]>(() => load("forja:routines:v1", []));
  const [tab, setTab] = useState<Tab>("explorar");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [genFocus, setGenFocus] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    localStorage.setItem("forja:profile:v1", JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem("forja:routines:v1", JSON.stringify(routines));
  }, [routines]);

  const toast = useCallback((msg: string, color?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, tone: color ? "sport" : "volt", color }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const completeOnboarding = useCallback((name: string, sports: string[]) => {
    setProfile({ name, sports, onboarded: true });
    setTab("explorar");
  }, []);

  const setName = useCallback((n: string) => setProfile((p) => ({ ...p, name: n })), []);

  const toggleSport = useCallback((id: string) => {
    setProfile((p) => {
      const has = p.sports.includes(id);
      if (has && p.sports.length === 1) return p;
      return { ...p, sports: has ? p.sports.filter((s) => s !== id) : [...p.sports, id] };
    });
  }, []);

  const saveRoutine = useCallback((r: Routine) => setRoutines((rs) => [r, ...rs]), []);
  const deleteRoutine = useCallback(
    (id: string) => setRoutines((rs) => rs.filter((r) => r.id !== id)),
    []
  );

  const updateItem = useCallback(
    (routineId: string, exerciseId: string, patch: Partial<RoutineItem>) => {
      setRoutines((rs) =>
        rs.map((r) =>
          r.id !== routineId
            ? r
            : {
                ...r,
                items: r.items.map((it) =>
                  it.exerciseId === exerciseId ? { ...it, ...patch } : it
                ),
              }
        )
      );
    },
    []
  );

  const removeItem = useCallback((routineId: string, exerciseId: string) => {
    setRoutines((rs) =>
      rs.map((r) =>
        r.id === routineId
          ? { ...r, items: r.items.filter((it) => it.exerciseId !== exerciseId) }
          : r
      )
    );
  }, []);

  const addToRoutine = useCallback(
    (routineId: string, exerciseId: string) => {
      setRoutines((rs) =>
        rs.map((r) => {
          if (r.id !== routineId) return r;
          if (r.items.some((it) => it.exerciseId === exerciseId)) return r;
          const ex = EXERCISES.find((e) => e.id === exerciseId);
          const d = ex ? DEFAULTS[ex.category] : DEFAULTS["Força"];
          return { ...r, items: [...r.items, { exerciseId, ...d }] };
        })
      );
    },
    []
  );

  const resetAll = useCallback(() => {
    localStorage.removeItem("forja:profile:v1");
    localStorage.removeItem("forja:routines:v1");
    setProfile({ name: "", sports: [], onboarded: false });
    setRoutines([]);
    setTab("explorar");
    setPlayerId(null);
    setAddFor(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        profile,
        routines,
        tab,
        playerId,
        addFor,
        toasts,
        genFocus,
        setGenFocus,
        setTab,
        openPlayer: setPlayerId,
        closePlayer: () => setPlayerId(null),
        openAdd: setAddFor,
        closeAdd: () => setAddFor(null),
        toast,
        completeOnboarding,
        setName,
        toggleSport,
        saveRoutine,
        deleteRoutine,
        updateItem,
        removeItem,
        addToRoutine,
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
