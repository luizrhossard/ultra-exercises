import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "../api";
import type { ApiProgressSession, ApiProgressSessionsPage, ApiReadinessTrend, ApiWeeklySummary } from "../api";
import { useApp } from "../store";
import { CACHE_TTL, userCacheKey } from "../cache";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { SectionLabel } from "../components/ui";
import { IconRefresh } from "../components/Icons";

const TREND_OPTIONS = [7, 30, 90] as const;
const PAGE_SIZE = 20;

const STATUS_LABEL: Record<ApiProgressSession["status"], string> = {
  PLANNED: "Planejada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  SKIPPED: "Pulada",
};

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** [UE-44] Tela de progresso do atleta: resumo semanal, tendência de prontidão e histórico paginado.
 *  Exibe somente métricas calculadas sobre dados reais do backend; nada técnico interno. */
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

// ---- Histórico paginado ----

function History({ token }: { token: string | null }) {
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

  const load = useCallback(
    async (page: number, replace: boolean) => {
      if (!token) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError("none");
      try {
        const data = await api.progressSessions(token, page, PAGE_SIZE);
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
    // Carga inicial: o seed síncrono do estado de carga é intencional (mesmo padrão
    // documentado em useCachedQuery); o fetch em si roda em callbacks assíncronos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, true);
  }, [load]);

  const retry = () => {
    if (pageInfo && pageInfo.page > 0) void load(pageInfo.page + 1, false);
    else void load(0, true);
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

  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-center">
        <p className="text-[12px] leading-relaxed text-fog-dim">
          Você ainda não registrou treinos concluídos. Complete sua primeira sessão para começar a acompanhar sua evolução.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-3 space-y-2">
        {items.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </ul>
      {pageInfo?.hasNext ? (
        <button
          onClick={() => pageInfo && void load(pageInfo.page + 1, false)}
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
  );
}

function SessionRow({ session: s }: { session: ApiProgressSession }) {
  return (
    <li className="rounded-xl border border-ink-700 bg-ink-850 p-3">
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
    </li>
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
