const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8085/api";

export type AuthResponse = { mfaRequired: boolean; challengeToken?: string | null; token?: string | null; email?: string | null; name?: string | null };
export type TwoFactorStatus = { enabled: boolean };
export type TwoFactorSetup = { secret: string; otpauthUri: string };
export type TwoFactorRecoveryCodes = { recoveryCodes: string[] };
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
// ---- Progresso [UE-44] ----
export type ApiProgressSession = { id: number; routineName: string | null; sportName: string; status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED"; scheduledAt: string; completedAt: string | null; durationMinutes: number | null; sessionRpe: number | null; maxPainLevel: number | null; totalVolumeKg: number | null; exerciseCount: number; setCount: number };
export type ApiProgressSessionsPage = { items: ApiProgressSession[]; page: number; size: number; totalItems: number; totalPages: number; hasNext: boolean };
export type ApiWeekBlock = { sessionsCompleted: number; totalDurationMinutes: number; totalVolumeKg: number | null; averageRpe: number | null; averageReadiness: number | null };
export type ApiWeeklySummary = { periodStart: string; periodEnd: string; current: ApiWeekBlock; previous: ApiWeekBlock };
export type ApiReadinessPoint = { date: string; readiness: number };
export type ApiReadinessTrend = { periodDays: number; items: ApiReadinessPoint[] };
// ---- Histórico avançado [UE-30] ----
export type HistoryFilters = {
  q?: string | null;
  exerciseId?: number | null;
  muscle?: string | null;
  intensity?: "LEVE" | "MODERADA" | "ALTA" | null;
  from?: string | null;
  to?: string | null;
};
export type ApiHistoryExerciseOption = { id: number; name: string };
export type ApiHistoryStats = {
  totalSessions: number;
  completedSessions: number;
  totalDurationMinutes: number;
  totalVolumeKg: number | null;
  averageRpe: number | null;
};
// ---- Dashboard de evolução [UE-27] ----
export type ApiEvolutionPoint = { date: string; maxLoadKg: number };
export type ApiExerciseEvolution = { exerciseId: number; months: number; items: ApiEvolutionPoint[] };
export type ApiVolumeBucket = { periodStart: string; totalVolumeKg: number };
export type ApiVolumeTrend = { granularity: "week" | "month"; months: number; items: ApiVolumeBucket[] };
export type ApiPerformanceBlock = {
  sessionsCompleted: number;
  totalDurationMinutes: number;
  totalVolumeKg: number | null;
  averageRpe: number | null;
};
export type ApiPerformanceComparison = {
  days: number;
  current: ApiPerformanceBlock;
  previous: ApiPerformanceBlock;
};

/** Origem da falha: resposta HTTP, rede indisponível ou timeout local. */
export type ApiErrorKind = "http" | "network" | "timeout";

/**
 * Erro padronizado da API. Nunca carrega texto bruto de respostas não-JSON
 * (pode conter detalhes internos de gateway/proxy).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fields?: { field: string; message: string }[];
  readonly traceId?: string;

  constructor(kind: ApiErrorKind, message: string, details: { status?: number; code?: string; fields?: { field: string; message: string }[]; traceId?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = details.status;
    this.code = details.code;
    this.fields = details.fields;
    this.traceId = details.traceId;
  }
}

const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 400;

const GENERIC_BY_STATUS: Record<number, string> = {
  400: "Os dados informados são inválidos.",
  401: "Não foi possível autenticar. Verifique suas credenciais ou entre novamente.",
  403: "Você não tem permissão para esta ação.",
  404: "Recurso não encontrado.",
  409: "Conflito com o estado atual. Atualize e tente novamente.",
  413: "Os dados enviados são muito grandes.",
  429: "Muitas tentativas. Aguarde um momento e tente novamente.",
};

function genericMessage(status: number): string {
  return GENERIC_BY_STATUS[status] ?? (status >= 500
    ? "Erro interno inesperado. Tente novamente em instantes."
    : "Algo deu errado. Tente novamente.");
}

type ErrorResponseContract = {
  status?: number;
  error?: string;
  message?: string;
  fields?: { field: string; message: string }[];
  traceId?: string;
};

async function attempt<T>(path: string, options: RequestInit, token?: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
      signal: controller.signal,
    });
  } catch (err) {
    // AbortError disparado pelo nosso timer = timeout; demais falhas = rede.
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: new ApiError("timeout", "A conexão demorou demais. Verifique sua internet e tente novamente.") };
    }
    return { ok: false, error: new ApiError("network", "Não foi possível conectar ao servidor. Verifique sua conexão.") };
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let details: { status?: number; code?: string; fields?: { field: string; message: string }[]; traceId?: string } = { status: response.status };
    let message = genericMessage(response.status);
    try {
      const body = JSON.parse(raw) as ErrorResponseContract;
      details = {
        status: response.status,
        code: body.error,
        fields: body.fields,
        traceId: body.traceId,
      };
      message = body.message || body.fields?.[0]?.message || message;
    } catch {
      // corpo não-JSON (ex.: gateway): mantém mensagem genérica, nunca o texto bruto
    }
    return { ok: false, error: new ApiError("http", message, details) };
  }

  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  return { ok: true, data };
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

/**
 * Wrapper de requisições com timeout e mensagens amigáveis.
 * Retry automático apenas em GET (idempotente) diante de falha de rede,
 * timeout ou 502/503/504 — uma única tentativa extra.
 */
export async function request<T>(path: string, options: RequestInit = {}, token?: string, opts?: { timeoutMs?: number }): Promise<T> {
  const isGet = (options.method ?? "GET").toUpperCase() === "GET";
  let lastError: ApiError | null = null;
  for (let tries = 0; tries < (isGet ? 2 : 1); tries++) {
    const result = await attempt<T>(path, options, token, opts?.timeoutMs);
    if (result.ok) return result.data;
    lastError = result.error;
    const retryable = result.error.kind !== "http"
      || (result.error.status !== undefined && RETRYABLE_STATUS.has(result.error.status));
    if (!isGet || !retryable) break;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  throw lastError;
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verifyTwoFactor: (challengeToken: string, code: string) => request<AuthResponse>("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ challengeToken, code }) }),
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
  // ---- Progresso [UE-44] ----
  progressSessions: (token: string, page: number, size = 20, filters: HistoryFilters = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (filters.q) params.set("q", filters.q);
    if (filters.exerciseId != null) params.set("exerciseId", String(filters.exerciseId));
    if (filters.muscle) params.set("muscle", filters.muscle);
    if (filters.intensity) params.set("intensity", filters.intensity);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    return request<ApiProgressSessionsPage>(`/progress/sessions?${params.toString()}`, {}, token);
  },
  progressHistoryExercises: (token: string) =>
    request<ApiHistoryExerciseOption[]>("/progress/history-exercises", {}, token),
  progressHistoryStats: (token: string, filters: HistoryFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.exerciseId != null) params.set("exerciseId", String(filters.exerciseId));
    if (filters.muscle) params.set("muscle", filters.muscle);
    if (filters.intensity) params.set("intensity", filters.intensity);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    return request<ApiHistoryStats>(`/progress/history-stats${qs ? `?${qs}` : ""}`, {}, token);
  },
  exerciseEvolution: (token: string, exerciseId: number, months = 6) =>
    request<ApiExerciseEvolution>(
      `/progress/exercise-evolution?exerciseId=${exerciseId}&months=${months}`, {}, token
    ),
  volumeTrend: (token: string, granularity: "week" | "month", months = 6) =>
    request<ApiVolumeTrend>(
      `/progress/volume-trend?granularity=${granularity}&months=${months}`, {}, token
    ),
  performanceComparison: (token: string, days = 30) =>
    request<ApiPerformanceComparison>(`/progress/performance-comparison?days=${days}`, {}, token),
  progressWeeklySummary: (token: string) => request<ApiWeeklySummary>("/progress/weekly-summary", {}, token),
  progressReadinessTrend: (token: string, days: number) =>
    request<ApiReadinessTrend>(`/progress/readiness-trend?days=${days}`, {}, token),
  // ---- Dois fatores (UE-24) ----
  twoFactorStatus: (token: string) => request<TwoFactorStatus>("/me/2fa/status", {}, token),
  setupTwoFactor: (token: string) => request<TwoFactorSetup>("/me/2fa/setup", { method: "POST" }, token),
  activateTwoFactor: (token: string, code: string) => request<TwoFactorRecoveryCodes>("/me/2fa/activate", { method: "POST", body: JSON.stringify({ code }) }, token),
  regenerateRecoveryCodes: (token: string, password: string, code: string) => request<TwoFactorRecoveryCodes>("/me/2fa/recovery-codes", { method: "POST", body: JSON.stringify({ password, code }) }, token),
  disableTwoFactor: (token: string, password: string, code: string) => request<void>("/me/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) }, token),
};
