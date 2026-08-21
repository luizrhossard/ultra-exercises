const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8085/api";

export type AuthResponse = { token: string; email: string; name: string | null };
export type AthleteProfile = {
  email: string;
  name: string | null;
  sports: { code: string; name: string; level: string }[];
};
export type Readiness = {
  date: string; sleepQuality: number; fatigue: number; stress: number; soreness: number;
  painArea: string | null; painLevel: number; notes: string | null; readinessScore: number; requiresReview: boolean;
};
export type ApiSport = { id: number; code: string; name: string; description: string | null };
export type ApiFeedItem = {
  exerciseId: number;
  name: string;
  category: "FORCA" | "PLIOMETRIA" | "CORE" | "CONDICIONAMENTO" | "MOBILIDADE" | "ESPECIFICO";
  equipment: string | null;
  muscles: string[];
  bestScore: number;
  strongCount: number;
  scoreBySport: Record<string, number>;
  rationaleBySport: Record<string, string>;
};
export type ApiRoutineItem = { exerciseId: number; exerciseName: string; position: number; sets: number; reps: string; restTime: number };
export type ApiRoutine = { id: number; name: string; sportCode: string; sportName: string; createdAt: string; items: ApiRoutineItem[] };
export type ApiSessionItem = { exerciseId: number; exerciseName: string; position: number; prescribedSets: number; prescribedReps: string; prescribedRestTime: number; completedSets: number | null; completedReps: string | null; loadKg: number | null; itemRpe: number | null; painLevel: number | null; notes: string | null };
export type ApiSession = { id: number; routineId: number | null; routineName: string | null; sportCode: string; sportName: string; status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED"; scheduledAt: string; startedAt: string | null; completedAt: string | null; durationMinutes: number | null; sessionRpe: number | null; notes: string | null; items: ApiSessionItem[] };

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `Erro ${response.status}`;
    try {
      const body = JSON.parse(raw) as { message?: string; fields?: { message?: string }[] };
      message = body.message || body.fields?.[0]?.message || message;
    } catch {
      // corpo não-JSON (ex.: gateway): mantém o texto bruto
    }
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  me: (token: string) => request<AthleteProfile>("/me", {}, token),
  saveProfile: (token: string, name: string, sports: string[]) => request<AthleteProfile>("/me", {
    method: "PUT", body: JSON.stringify({ name, sports: sports.map((code) => ({ code, level: "COMPETITIVE" })) }),
  }, token),
  todayReadiness: (token: string) => request<Readiness | null>("/readiness/today", {}, token),
  saveReadiness: (token: string, body: Omit<Readiness, "date" | "readinessScore" | "requiresReview">) =>
    request<Readiness>("/readiness/today", { method: "PUT", body: JSON.stringify(body) }, token),
  sports: () => request<ApiSport[]>("/sports"),
  exercisesFeed: (sportIds: number[], q?: string, category?: string) => {
    const params = new URLSearchParams();
    for (const id of sportIds) params.append("sportIds", String(id));
    if (q) params.append("q", q);
    if (category) params.append("category", category);
    const qs = params.toString();
    return request<ApiFeedItem[]>(`/exercises/feed${qs ? `?${qs}` : ""}`);
  },
  routines: (token: string) => request<ApiRoutine[]>("/routines", {}, token),
  generateRoutine: (token: string, sportId: number) => request<ApiRoutine>("/routines/generate", { method: "POST", body: JSON.stringify({ sportId }) }, token),
  createSession: (token: string, routineId: number) => request<ApiSession>(`/routines/${routineId}/sessions`, { method: "POST" }, token),
  startSession: (token: string, sessionId: number) => request<ApiSession>(`/sessions/${sessionId}/start`, { method: "POST" }, token),
  patchSession: (token: string, sessionId: number, body: { status?: string; durationMinutes?: number; sessionRpe?: number; notes?: string }) => request<ApiSession>(`/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  patchSessionItem: (token: string, sessionId: number, exerciseId: number, body: { completedSets?: number; completedReps?: string; loadKg?: number; itemRpe?: number; painLevel?: number; notes?: string }) => request<ApiSession>(`/sessions/${sessionId}/items/${exerciseId}`, { method: "PATCH", body: JSON.stringify(body) }, token),
};
