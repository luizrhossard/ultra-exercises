import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "../api";
import type {
  ApiExerciseEvolution,
  ApiHistoryExerciseOption,
  ApiHistoryStats,
  ApiPerformanceComparison,
  ApiProgressSession,
  ApiProgressSessionsPage,
  ApiReadinessTrend,
  ApiVolumeTrend,
  ApiWeeklySummary,
  HistoryFilters,
} from "../api";
import { MUSCLE_LABEL } from "../types";
import type { MuscleKey } from "../types";
import { useApp } from "../store";
import { CACHE_TTL, userCacheKey } from "../cache";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { SectionLabel } from "../components/ui";
import { IconRefresh, IconX } from "../components/Icons";
import { BarChart, LineChart } from "../components/charts";

const TREND_OPTIONS = [7, 30, 90] as const;
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_LABEL: Record<ApiProgressSession["status"], string> = {
  PLANNED: "Planejada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  SKIPPED: "Pulada",
};

const INTENSITY_OPTIONS = [
  { value: "LEVE", label: "Leve" },
  { value: "MODERADA", label: "Moderada" },
  { value: "ALTA", label: "Alta" },
] as const;

interface FilterState {
  q: string;
  exerciseId: string;
  muscle: string;
  intensity: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterState = { q: "", exerciseId: "", muscle: "", intensity: "", from: "", to: "" };

function toApiFilters(f: FilterState): HistoryFilters {
  const out: HistoryFilters = {};
  if (f.q.trim()) out.q = f.q.trim();
  if (f.exerciseId) out.exerciseId = Number(f.exerciseId);
  if (f.muscle) out.muscle = f.muscle;
  if (f.intensity) out.intensity = f.intensity as HistoryFilters["intensity"];
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  return out;
}

function hasActiveFilters(f: FilterState): boolean {
  return Object.values(f).some((v) => v.trim() !== "");
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** [UE-44] Tela de progresso do atleta: resumo semanal, tendência de prontidão e histórico paginado.
 *  [UE-30] Histórico com filtros avançados (busca, exercício, grupo muscular, intensidade, período),
 *  estatísticas do período e timeline visual. Exibe somente métricas sobre dados reais do backend. */
export default function Progress() {
  const { token } = useApp();
  const userKey = token ? userCacheKey(token) : "";

  const summaryQuery = useCachedQuery<ApiWeeklySummary>({
    userKey,
    key: "progress/weekly-summary",
    ttl: CACHE_TTL.progress,
    fetcher: () => api.progressWeeklySummary(token as string),
    enabled: Boolean(token),
  });

  const [trendDays, setTrendDays] = useState<number>(30);
  const trendQuery = useCachedQuery<ApiReadinessTrend>({
    userKey,
    key: `progress/readiness-trend:${trendDays}`,
    ttl: CACHE_TTL.progress,
    fetcher: () => api.progressReadinessTrend(token as string, trendDays),
    enabled: Boolean(token),
  });

  return (
    <div className="px-5 pb-32 pt-6 lg:mx-auto lg:max-w-5xl lg:px-10 lg:pb-24 lg:pt-10">
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-[40px] uppercase leading-none text-fog lg:text-[56px]"
      >
        Progresso
      </motion.h1>
      <p className="mt-2 text-[13px] text-fog-dim">
        Acompanhe seus treinos e veja como sua consistência evolui.
      </p>

      <section className="mt-7">
        <SectionLabel>Semana atual · resumo</SectionLabel>
        <WeeklySummary query={summaryQuery} />
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Prontidão · tendência</SectionLabel>
          <div role="group" aria-label="Período da tendência" className="flex gap-1">
            {TREND_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                aria-pressed={trendDays === d}
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  trendDays === d ? "bg-volt-400/15 text-volt-300" : "bg-ink-800 text-fog-mute hover:text-fog-dim"
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>
        <ReadinessTrend query={trendQuery} days={trendDays} />
      </section>

      <section className="mt-8">
        <SectionLabel>Evolução · dashboard</SectionLabel>
        <Dashboard token={token} />
      </section>

      <section className="mt-8">
        <SectionLabel>Histórico de treinos</SectionLabel>
        <History token={token} />
      </section>
    </div>
  );
}

// ---- Resumo semanal ----

function WeeklySummary({ query }: { query: ReturnType<typeof useCachedQuery<ApiWeeklySummary>> }) {
  if (query.loading) return <SkeletonCards count={5} />;
  if (query.error || !query.data) {
    return <ErrorCard message="Não foi possível carregar seu resumo semanal." onRetry={query.refresh} />;
  }
  const { current, previous } = query.data;
  // Variação só quando existe base histórica comparável na semana anterior.
  const hasCountBase = previous.sessionsCompleted > 0;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Treinos concluídos"
        value={fmt(current.sessionsCompleted)}
        delta={hasCountBase ? current.sessionsCompleted - previous.sessionsCompleted : null}
      />
      <MetricCard
        label="Duração total"
        value={`${fmt(current.totalDurationMinutes)} min`}
        delta={hasCountBase ? current.totalDurationMinutes - previous.totalDurationMinutes : null}
      />
      <MetricCard
        label="Volume total"
        value={current.totalVolumeKg != null ? `${fmt(current.totalVolumeKg)} kg` : "—"}
        delta={
          hasCountBase && current.totalVolumeKg != null && previous.totalVolumeKg != null
            ? current.totalVolumeKg - previous.totalVolumeKg
            : null
        }
      />
      <MetricCard
        label="RPE médio"
        value={current.averageRpe != null ? fmt(current.averageRpe) : "—"}
        delta={
          current.averageRpe != null && previous.averageRpe != null
            ? current.averageRpe - previous.averageRpe
            : null
        }
      />
      <MetricCard
        label="Prontidão média"
        value={current.averageReadiness != null ? fmt(current.averageReadiness) : "—"}
        delta={
          current.averageReadiness != null && previous.averageReadiness != null
            ? current.averageReadiness - previous.averageReadiness
            : null
        }
      />
    </div>
  );
}

function MetricCard({ label, value, delta }: { label: string; value: string; delta: number | null }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-fog-mute">{label}</p>
      <p className="tabular mt-1.5 font-display text-xl leading-none text-fog">{value}</p>
      {delta != null && delta !== 0 && (
        <p className={`mt-1.5 text-[10px] font-bold ${delta > 0 ? "text-[#34d97b]" : "text-[#ff8a2a]"}`}>
          {delta > 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} vs semana anterior
        </p>
      )}
      {delta != null && delta === 0 && (
        <p className="mt-1.5 text-[10px] font-bold text-fog-mute">= semana anterior</p>
      )}
    </div>
  );
}

// ---- Tendência de prontidão ----

function ReadinessTrend({
  query,
  days,
}: {
  query: ReturnType<typeof useCachedQuery<ApiReadinessTrend>>;
  days: number;
}) {
  if (query.loading) {
    return <div aria-hidden="true" className="mt-3 h-[150px] animate-pulse rounded-xl border border-ink-800 bg-ink-850/60" />;
  }
  if (query.error || !query.data) {
    return <ErrorCard message="Não foi possível carregar sua tendência de prontidão." onRetry={query.refresh} />;
  }
  const items = query.data.items;
  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-center">
        <p className="text-[12px] text-fog-dim">
          Sem check-ins de prontidão nos últimos {days} dias. Registre seu check-in diário para acompanhar a tendência.
        </p>
      </div>
    );
  }

  const avg = items.reduce((sum, i) => sum + i.readiness, 0) / items.length;
  const w = 320;
  const h = 120;
  const pad = 10;
  const scores = items.map((i) => i.readiness);
  const lo = Math.min(...scores) - 1;
  const hi = Math.max(...scores) + 1;
  const span = Math.max(1, hi - lo);
  const x = (idx: number) => (items.length === 1 ? w / 2 : pad + (idx * (w - 2 * pad)) / (items.length - 1));
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  const points = items.map((p, i) => `${x(i)},${y(p.readiness)}`).join(" ");

  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[120px] w-full"
        role="img"
        aria-label={`Prontidão nos últimos ${days} dias: ${items.length} registro${items.length === 1 ? "" : "s"}, média ${fmt(avg)} em uma escala de 0 a 30.`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="#d4f53c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {items.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.readiness)} r="3.5" fill="#d4f53c">
            <title>{`${p.date}: prontidão ${p.readiness}`}</title>
          </circle>
        ))}
      </svg>
      {/* Alternativa textual para leitores de tela */}
      <ul className="sr-only">
        {items.map((p) => (
          <li key={p.date}>
            {p.date}: prontidão {p.readiness}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.14em] text-fog-mute">
        Somente dias com check-in · escala 0–30
      </p>
    </div>
  );
}

// ---- Dashboard de evolução [UE-27] ----

const MONTH_OPTIONS = [3, 6, 12] as const;

function Dashboard({ token }: { token: string | null }) {
  const userKey = token ? userCacheKey(token) : "";
  const exercisesQuery = useCachedQuery<ApiHistoryExerciseOption[]>({
    userKey,
    key: "progress/history-exercises",
    ttl: CACHE_TTL.progress,
    fetcher: () => api.progressHistoryExercises(token as string),
    enabled: Boolean(token),
  });
  const exercises = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data]);

  const [exerciseId, setExerciseId] = useState<string>("");
  const [months, setMonths] = useState<number>(6);
  const [granularity, setGranularity] = useState<"week" | "month">("week");

  // Seleciona o primeiro exercício treinado quando a lista chega.
  useEffect(() => {
    if (!exerciseId && exercises.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExerciseId(String(exercises[0].id));
    }
  }, [exercises, exerciseId]);

  const evolutionQuery = useCachedQuery<ApiExerciseEvolution>({
    userKey,
    key: `progress/exercise-evolution:${exerciseId}:${months}`,
    ttl: CACHE_TTL.progress,
    fetcher: () => api.exerciseEvolution(token as string, Number(exerciseId), months),
    enabled: Boolean(token) && exerciseId !== "",
  });

  const volumeQuery = useCachedQuery<ApiVolumeTrend>({
    userKey,
    key: `progress/volume-trend:${granularity}:${months}`,
    ttl: CACHE_TTL.progress,
    fetcher: () => api.volumeTrend(token as string, granularity, months),
    enabled: Boolean(token),
  });

  const comparisonQuery = useCachedQuery<ApiPerformanceComparison>({
    userKey,
    key: "progress/performance-comparison:30",
    ttl: CACHE_TTL.progress,
    fetcher: () => api.performanceComparison(token as string, 30),
    enabled: Boolean(token),
  });

  if (!token) return null;

  if (exercises.length === 0) {
    if (exercisesQuery.loading) {
      return <div aria-hidden="true" className="mt-3 h-[120px] animate-pulse rounded-xl border border-ink-800 bg-ink-850/60" />;
    }
    return (
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-center">
        <p className="text-[12px] text-fog-dim">
          Complete treinos para ver sua evolução por aqui — cargas, volume e comparativos.
        </p>
      </div>
    );
  }

  const selectCls =
    "rounded-lg bg-ink-800 px-2 py-1.5 text-[11px] text-fog outline-none focus:ring-1 focus:ring-volt-400/60";
  const evoPoints = (evolutionQuery.data?.items ?? []).map((p) => ({
    label: shortDate(p.date),
    value: p.maxLoadKg,
  }));
  const volBars = (volumeQuery.data?.items ?? []).map((b) => ({
    label: granularity === "month" ? b.periodStart.slice(0, 7) : shortDate(b.periodStart),
    value: b.totalVolumeKg,
  }));
  const comparison = comparisonQuery.data;

  return (
    <div className="mt-3 space-y-3">
      {/* Evolução de carga por exercício */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog-dim">Carga máxima · exercício</p>
          <div className="flex items-center gap-2">
            <select
              aria-label="Exercício da evolução"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className={selectCls}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Período da evolução"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className={selectCls}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
            </select>
          </div>
        </div>
        {evolutionQuery.loading ? (
          <div aria-hidden="true" className="mt-2 h-[150px] animate-pulse rounded-lg bg-ink-900/60" />
        ) : evolutionQuery.error ? (
          <ErrorCard message="Não foi possível carregar a evolução de carga." onRetry={evolutionQuery.refresh} />
        ) : evoPoints.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-fog-mute">
            Sem cargas registradas para este exercício no período.
          </p>
        ) : (
          <LineChart
            points={evoPoints}
            unit=" kg"
            filename={`evolucao-carga-${exerciseId}.png`}
            ariaLabel={`Evolução de carga máxima: ${evoPoints.length} registro${evoPoints.length === 1 ? "" : "s"} nos últimos ${months} meses.`}
          />
        )}
      </div>

      {/* Volume por semana/mês */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog-dim">Volume total · treinos concluídos</p>
          <div role="group" aria-label="Granularidade do volume" className="flex gap-1">
            {([["week", "Semanas"], ["month", "Meses"]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setGranularity(value)}
                aria-pressed={granularity === value}
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  granularity === value ? "bg-volt-400/15 text-volt-300" : "bg-ink-800 text-fog-mute hover:text-fog-dim"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {volumeQuery.loading ? (
          <div aria-hidden="true" className="mt-2 h-[150px] animate-pulse rounded-lg bg-ink-900/60" />
        ) : volumeQuery.error ? (
          <ErrorCard message="Não foi possível carregar o volume por período." onRetry={volumeQuery.refresh} />
        ) : volBars.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-fog-mute">Sem treinos concluídos no período.</p>
        ) : (
          <BarChart
            points={volBars}
            unit=" kg"
            filename={`volume-${granularity}.png`}
            ariaLabel={`Volume ${granularity === "month" ? "mensal" : "semanal"}: ${volBars.length} perío${volBars.length === 1 ? "do" : "dos"} com treinos concluídos.`}
          />
        )}
      </div>

      {/* Comparativo hoje vs mês passado */}
      {comparison ? (
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog-dim">
            Comparativo · últimos {comparison.days} dias vs anteriores
          </p>
          {(() => {
            const c = comparison.current;
            const p = comparison.previous;
            const base = p.sessionsCompleted > 0;
            return (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricCard
                  label={`Concluídos (${comparison.days}d)`}
                  value={fmt(c.sessionsCompleted)}
                  delta={base ? c.sessionsCompleted - p.sessionsCompleted : null}
                />
                <MetricCard
                  label="Duração total"
                  value={`${fmt(c.totalDurationMinutes)} min`}
                  delta={base ? c.totalDurationMinutes - p.totalDurationMinutes : null}
                />
                <MetricCard
                  label="Volume total"
                  value={c.totalVolumeKg != null ? `${fmt(c.totalVolumeKg)} kg` : "—"}
                  delta={
                    base && c.totalVolumeKg != null && p.totalVolumeKg != null
                      ? c.totalVolumeKg - p.totalVolumeKg
                      : null
                  }
                />
                <MetricCard
                  label="RPE médio"
                  value={c.averageRpe != null ? fmt(c.averageRpe) : "—"}
                  delta={
                    c.averageRpe != null && p.averageRpe != null ? c.averageRpe - p.averageRpe : null
                  }
                />
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

// ---- Histórico com filtros avançados [UE-30] ----

function History({ token }: { token: string | null }) {
  const userKey = token ? userCacheKey(token) : "";
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<ApiProgressSession[]>([]);
  const [pageInfo, setPageInfo] = useState<ApiProgressSessionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<"none" | "generic" | "auth">("none");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Busca textual com debounce para não disparar requisição por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(filters.q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.q]);

  const exercisesQuery = useCachedQuery<ApiHistoryExerciseOption[]>({
    userKey,
    key: "progress/history-exercises",
    ttl: CACHE_TTL.progress,
    fetcher: () => api.progressHistoryExercises(token as string),
    enabled: Boolean(token),
  });

  const activeFilters: HistoryFilters = useMemo(
    () => toApiFilters({ ...filters, q: debouncedQ }),
    [filters, debouncedQ]
  );
  const activeKey = JSON.stringify(activeFilters);

  const statsQuery = useCachedQuery<ApiHistoryStats>({
    userKey,
    key: `progress/history-stats:${activeKey}`,
    ttl: CACHE_TTL.progress,
    fetcher: () => api.progressHistoryStats(token as string, activeFilters),
    enabled: Boolean(token),
  });

  const load = useCallback(
    async (page: number, replace: boolean, f: HistoryFilters) => {
      if (!token) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError("none");
      try {
        const data = await api.progressSessions(token, page, PAGE_SIZE, f);
        if (!mounted.current) return;
        setItems((prev) => {
          if (replace) return data.items;
          const seen = new Set(prev.map((s) => s.id));
          return [...prev, ...data.items.filter((s) => !seen.has(s.id))];
        });
        setPageInfo(data);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof ApiError && err.status === 401 ? "auth" : "generic");
      } finally {
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    // Recarrega ao montar e sempre que o conjunto de filtros efetivo muda.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, true, activeFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const retry = () => {
    if (pageInfo && pageInfo.page > 0) void load(pageInfo.page + 1, false, activeFilters);
    else void load(0, true, activeFilters);
  };

  if (loading) {
    return (
      <div aria-hidden="true" className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl border border-ink-800 bg-ink-850/60" />
        ))}
      </div>
    );
  }

  if (error !== "none") {
    return (
      <ErrorCard
        message={
          error === "auth"
            ? "Sua sessão expirou. Entre novamente para ver seu histórico."
            : "Não foi possível carregar seu histórico de treinos."
        }
        onRetry={retry}
      />
    );
  }

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
        exercises={exercisesQuery.data ?? []}
      />
      <PeriodStats query={statsQuery} />
      {items.length === 0 ? (
        hasActiveFilters(filters) ? (
          <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-center">
            <p className="text-[12px] text-fog-dim">Nenhum treino encontrado para os filtros aplicados.</p>
            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setDebouncedQ("");
              }}
              className="mx-auto mt-2 flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300"
            >
              <IconX size={11} /> Limpar filtros
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-center">
            <p className="text-[12px] leading-relaxed text-fog-dim">
              Você ainda não registrou treinos concluídos. Complete sua primeira sessão para começar a acompanhar sua evolução.
            </p>
          </div>
        )
      ) : (
        <>
          <ol className="relative mt-3 space-y-2 border-l border-ink-700 pl-5">
            {items.map((s) => (
              <li key={s.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[27px] top-4 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-volt-400"
                />
                <SessionRow session={s} />
              </li>
            ))}
          </ol>
          {pageInfo?.hasNext ? (
            <button
              onClick={() => pageInfo && void load(pageInfo.page + 1, false, activeFilters)}
              disabled={loadingMore}
              className="mx-auto mt-3 block rounded-lg border border-volt-400/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-volt-300 transition-colors hover:bg-volt-400/10 disabled:opacity-50"
            >
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          ) : (
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-fog-mute">
              Fim do histórico · {pageInfo?.totalItems ?? items.length} sessões
            </p>
          )}
        </>
      )}
    </>
  );
}

function FilterBar({
  filters,
  onChange,
  onClear,
  exercises,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  exercises: ApiHistoryExerciseOption[];
}) {
  const inputCls =
    "mt-1 block w-full rounded-lg bg-ink-800 p-2 text-[12px] text-fog outline-none focus:ring-1 focus:ring-volt-400/60";
  const labelCls = "block text-[9px] font-bold uppercase tracking-[0.14em] text-fog-mute";
  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className={labelCls}>
          Buscar
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Rotina, esporte, exercício…"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Exercício
          <select
            value={filters.exerciseId}
            onChange={(e) => onChange({ exerciseId: e.target.value })}
            className={inputCls}
          >
            <option value="">Todos</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Grupo muscular
          <select
            value={filters.muscle}
            onChange={(e) => onChange({ muscle: e.target.value })}
            className={inputCls}
          >
            <option value="">Todos</option>
            {(Object.keys(MUSCLE_LABEL) as MuscleKey[]).map((k) => (
              <option key={k} value={k}>
                {MUSCLE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Intensidade
          <select
            value={filters.intensity}
            onChange={(e) => onChange({ intensity: e.target.value })}
            className={inputCls}
          >
            <option value="">Todas</option>
            {INTENSITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          De
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Até
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
      {hasActiveFilters(filters) && (
        <button
          onClick={onClear}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300"
        >
          <IconX size={11} /> Limpar filtros
        </button>
      )}
    </div>
  );
}

function PeriodStats({ query }: { query: ReturnType<typeof useCachedQuery<ApiHistoryStats>> }) {
  // Bloco auxiliar: falha silenciosa para não competir com o erro do histórico.
  if (query.loading || query.error || !query.data) return null;
  const s = query.data;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard label="Treinos no período" value={fmt(s.totalSessions)} delta={null} />
      <MetricCard label="Concluídos" value={fmt(s.completedSessions)} delta={null} />
      <MetricCard label="Duração total" value={`${fmt(s.totalDurationMinutes)} min`} delta={null} />
      <MetricCard
        label="Volume total"
        value={s.totalVolumeKg != null ? `${fmt(s.totalVolumeKg)} kg` : "—"}
        delta={null}
      />
      <MetricCard label="RPE médio" value={s.averageRpe != null ? fmt(s.averageRpe) : "—"} delta={null} />
    </div>
  );
}

function SessionRow({ session: s }: { session: ApiProgressSession }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-fog">{s.routineName ?? s.sportName}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-fog-mute">
            {shortDate(s.scheduledAt)} · {s.sportName}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
            s.status === "COMPLETED" ? "bg-volt-400/12 text-volt-300" : "bg-ink-800 text-fog-mute"
          }`}
        >
          {STATUS_LABEL[s.status]}
        </span>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fog-dim">
        {s.durationMinutes != null && (
          <div>
            <dt className="sr-only">Duração</dt>
            <dd>{s.durationMinutes} min</dd>
          </div>
        )}
        {s.sessionRpe != null && (
          <div>
            <dt className="sr-only">RPE da sessão</dt>
            <dd>RPE {s.sessionRpe}</dd>
          </div>
        )}
        {s.totalVolumeKg != null && s.totalVolumeKg > 0 && (
          <div>
            <dt className="sr-only">Volume total</dt>
            <dd>{fmt(s.totalVolumeKg)} kg</dd>
          </div>
        )}
        <div>
          <dt className="sr-only">Séries e exercícios</dt>
          <dd>
            {s.setCount} séries · {s.exerciseCount} exercícios
          </dd>
        </div>
        {s.maxPainLevel != null && s.maxPainLevel > 0 && (
          <div>
            <dt className="sr-only">Dor máxima registrada</dt>
            <dd className="text-[#ff8a2a]">Dor máx. {s.maxPainLevel}/10</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ---- Blocos compartilhados ----

function SkeletonCards({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-xl border border-ink-800 bg-ink-850/60" />
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-3 rounded-xl border border-[#ff5148]/30 bg-[#ff5148]/8 p-3.5">
      <p className="text-[12px] text-fog-dim">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-volt-400/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-volt-300 transition-colors hover:bg-volt-400/10"
      >
        <IconRefresh size={13} /> Tentar novamente
      </button>
    </div>
  );
}
