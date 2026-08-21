import { useEffect, useState } from "react";
import { api, type Readiness } from "../api";
import { useApp } from "../store";
import { CACHE_TTL, setCache, userCacheKey } from "../cache";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { IconBolt } from "./Icons";

const fields = [
  ["sleepQuality", "Sono", "1 ruim · 5 excelente"],
  ["fatigue", "Fadiga", "1 baixa · 5 alta"],
  ["stress", "Estresse", "1 baixo · 5 alto"],
  ["soreness", "Dor muscular", "1 baixa · 5 alta"],
] as const;

export default function ReadinessCard() {
  const { token, toast } = useApp();
  const [values, setValues] = useState({ sleepQuality: 3, fatigue: 3, stress: 3, soreness: 3, painArea: "", painLevel: 0, notes: "" });
  const [score, setScore] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  const userKey = token ? userCacheKey(token) : "";
  const readiness = useCachedQuery<Readiness | null>({
    userKey,
    key: "readiness/today",
    ttl: CACHE_TTL.readiness,
    fetcher: () => api.todayReadiness(token as string),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!readiness.data) return;
    const data = readiness.data;
    // Sincroniza os dados remotos com o formulário quando o SWR atualiza (padrão intencional).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues({ sleepQuality: data.sleepQuality, fatigue: data.fatigue, stress: data.stress, soreness: data.soreness, painArea: data.painArea ?? "", painLevel: data.painLevel, notes: data.notes ?? "" });
    setScore(data.readinessScore);
    setReview(data.requiresReview);
  }, [readiness.data]);

  useEffect(() => {
    if (readiness.error) toast("Não foi possível carregar a prontidão.");
  }, [readiness.error, toast]);

  const save = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.saveReadiness(token, values);
      setCache(userKey, "readiness/today", data, CACHE_TTL.readiness);
      setScore(data.readinessScore); setReview(data.requiresReview);
      toast(data.requiresReview ? "Check-in salvo: revise o treino com a comissão." : "Prontidão salva.");
    } catch { toast("Não foi possível salvar o check-in."); }
    finally { setBusy(false); }
  };

  return <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-850 p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-volt-300"><IconBolt size={14} /> Check-in de prontidão</p><p className="mt-1 text-[11px] text-fog-mute">Preencha antes de iniciar o treino.</p></div>{score !== null && <span className="rounded-lg bg-volt-400/12 px-2.5 py-1 text-[12px] font-bold text-volt-300">{score}/30</span>}</div>
    <div className="mt-4 grid grid-cols-2 gap-3">{fields.map(([key, label, hint]) => <label key={key} className="rounded-xl bg-ink-800 p-2.5"><span className="block text-[11px] font-bold text-fog">{label}</span><span className="block text-[9px] text-fog-mute">{hint}</span><input type="range" min="1" max="5" value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))} className="mt-2 w-full accent-[#d4f53c]" /><span className="text-[11px] font-bold text-volt-300">{values[key]}/5</span></label>)}</div>
    <div className="mt-3 grid grid-cols-[1fr_88px] gap-3"><input value={values.painArea} onChange={(e) => setValues((v) => ({ ...v, painArea: e.target.value }))} maxLength={80} placeholder="Local de dor (opcional)" className="rounded-xl border border-ink-700 bg-ink-800 px-3 text-[12px] text-fog outline-none focus:border-volt-400" /><label className="rounded-xl border border-ink-700 bg-ink-800 px-2 py-1.5 text-center text-[10px] text-fog-mute">Dor <input type="number" min="0" max="10" value={values.painLevel} onChange={(e) => setValues((v) => ({ ...v, painLevel: Math.max(0, Math.min(10, Number(e.target.value))) }))} className="block w-full bg-transparent text-center text-sm font-bold text-fog outline-none" /></label></div>
    {review && <p className="mt-3 rounded-lg bg-[#ff5148]/12 p-2.5 text-[11px] text-[#ff9a95]">Sinal de atenção: ajuste ou revise a sessão com o profissional responsável antes de treinar.</p>}
    <button onClick={save} disabled={busy} className="mt-3 w-full rounded-xl bg-volt-400 py-2.5 text-[12px] font-bold uppercase tracking-[.1em] text-ink-950 disabled:opacity-60">{busy ? "Salvando…" : "Salvar prontidão"}</button>
  </section>;
}
