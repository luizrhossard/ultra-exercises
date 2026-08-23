import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { api, type ApiRoutine, type ApiSession, type ApiSport } from "../api";
import { useApp } from "../store";
import { Sheet } from "../components/ui";
import { IconBolt, IconCheck, IconRefresh, IconTimer } from "../components/Icons";
import { CACHE_TTL, invalidate, userCacheKey } from "../cache";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { exportSvgAsPng } from "../components/charts";
import { RoutinePrintSheet, RoutineSheetSvg, routineShareText } from "../components/RoutineSheet";

type ExportKind = "pdf" | "png" | "qr" | "whatsapp" | "email";

export default function Routines() {
  const { token, profile, toast } = useApp();
  const [focus, setFocus] = useState(profile.sports[0] ?? "");
  const [generating, setGenerating] = useState(false);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [printRoutine, setPrintRoutine] = useState<ApiRoutine | null>(null);
  const [pngRoutine, setPngRoutine] = useState<ApiRoutine | null>(null);
  const [qr, setQr] = useState<{ name: string; url: string; dataUrl: string } | null>(null);
  const pngRef = useRef<HTMLDivElement | null>(null);

  const userKey = token ? userCacheKey(token) : "";
  const sportsQuery = useCachedQuery<ApiSport[]>({
    userKey,
    key: "sports",
    ttl: CACHE_TTL.sports,
    fetcher: () => api.sports(),
    enabled: Boolean(token),
  });
  const routinesQuery = useCachedQuery<ApiRoutine[]>({
    userKey,
    key: "routines",
    ttl: CACHE_TTL.routines,
    fetcher: () => api.routines(token as string),
    enabled: Boolean(token),
  });

  const loading = sportsQuery.loading || routinesQuery.loading;
  const sports = useMemo(
    () => (sportsQuery.data ?? []).filter((sport) => profile.sports.includes(sport.code)),
    [sportsQuery.data, profile.sports]
  );
  const routines = routinesQuery.data ?? [];

  // [UE-29] PDF: abre o diálogo de impressão com apenas a folha visível.
  useEffect(() => {
    if (!printRoutine) return;
    const done = () => setPrintRoutine(null);
    window.addEventListener("afterprint", done);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.removeEventListener("afterprint", done);
      window.clearTimeout(timer);
    };
  }, [printRoutine]);

  // [UE-29] PNG: renderiza a folha SVG fora da tela e exporta via canvas.
  useEffect(() => {
    if (!pngRoutine) return;
    const svg = pngRef.current?.querySelector("svg");
    if (!svg) return;
    const filename = `rotina-${pngRoutine.id}.png`;
    const finish = () => setPngRoutine(null);
    void exportSvgAsPng(svg as unknown as SVGSVGElement, filename).then(finish, finish);
  }, [pngRoutine]);

  const handleExport = async (kind: ExportKind, routine: ApiRoutine) => {
    if (kind === "pdf") { setPrintRoutine(routine); return; }
    if (kind === "png") { setPngRoutine(routine); return; }
    if (!token) return;
    try {
      const { url } = await api.generateShareLink(token, routine.id);
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 440 });
      setQr({ name: routine.name, url, dataUrl });
    } catch {
      toast("Não foi possível gerar o QR Code.");
    }
  };

  useEffect(() => {
    if (sportsQuery.error || routinesQuery.error) toast("Não foi possível carregar suas rotinas.");
  }, [sportsQuery.error, routinesQuery.error, toast]);

  const focusSport = useMemo(() => sports.find((sport) => sport.code === focus), [sports, focus]);
  const generate = async () => {
    if (!token || !focusSport) return;
    setGenerating(true);
    try {
      await api.generateRoutine(token, focusSport.id);
      invalidate(userKey, /routines/);
      routinesQuery.refresh();
      toast(`Treino de ${focusSport.name} criado.`);
    } catch { toast("Não foi possível gerar o treino."); }
    finally { setGenerating(false); }
  };
  const start = async (routine: ApiRoutine) => {
    if (!token) return;
    try {
      const planned = await api.createSession(token, routine.id);
      setSession(await api.startSession(token, planned.id));
      toast("Sessão iniciada. Registre cada exercício.");
    } catch { toast("Não foi possível iniciar a sessão."); }
  };

  return <div className="px-5 pb-32 pt-6 lg:mx-auto lg:max-w-5xl lg:px-10 lg:pt-10">
    <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="font-display text-[40px] uppercase leading-none text-fog lg:text-[56px]">Rotinas</motion.h1>
    <p className="mt-2 max-w-xl text-[13px] text-fog-dim">Prescrição centralizada e sessão executada com carga, RPE e dor por exercício.</p>
    <section className="mt-5 rounded-2xl border border-ink-600 bg-ink-850 p-5">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-400 text-ink-950"><IconBolt size={17} /></span><h2 className="font-display text-xl uppercase text-fog">Treino do dia</h2></div>
      <div className="mt-4 flex flex-wrap gap-2">{sports.map((sport) => <button key={sport.code} onClick={() => setFocus(sport.code)} className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${focus === sport.code ? "border-volt-400 bg-volt-400/12 text-volt-300" : "border-ink-700 text-fog-mute"}`}>{sport.name}</button>)}</div>
      <button disabled={!focusSport || generating} onClick={generate} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-volt-400 py-3.5 font-display uppercase text-ink-950 disabled:opacity-50">{generating ? <><IconRefresh className="animate-spin" size={17} /> Gerando…</> : <><IconBolt size={17} /> Gerar para {focusSport?.name ?? "seu esporte"}</>}</button>
    </section>
    <div className="mt-7 flex items-baseline justify-between"><h2 className="font-display text-xl uppercase text-fog">Prescritas</h2><button onClick={() => { routinesQuery.refresh(); sportsQuery.refresh(); }} className="text-[11px] font-bold uppercase text-volt-300">Atualizar</button></div>
    <div className="mt-3 space-y-3">{loading ? <RoutineListSkeleton /> : routines.length === 0 ? <p className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-[13px] text-fog-mute">Gere sua primeira rotina acima.</p> : routines.map((routine) => <RoutineCard key={routine.id} routine={routine} onStart={() => void start(routine)} onExport={(kind) => void handleExport(kind, routine)} />)}</div>
    <SessionSheet session={session} onClose={() => setSession(null)} onChange={setSession} />
    {printRoutine && <RoutinePrintSheet routine={printRoutine} />}
    <div ref={pngRef} aria-hidden="true" style={{ position: "absolute", left: -9999, top: 0 }}>
      {pngRoutine && <RoutineSheetSvg routine={pngRoutine} />}
    </div>
    <Sheet open={!!qr} onClose={() => setQr(null)} title={qr ? `QR · ${qr.name}` : ""}>
      {qr && (
        <div className="flex flex-col items-center gap-3 pb-4">
          <img src={qr.dataUrl} alt={`QR Code da rotina ${qr.name}`} data-testid="qr-image" className="h-[220px] w-[220px] rounded-xl bg-white p-2" />
          <p className="break-all text-center text-[11px] text-fog-mute">{qr.url}</p>
          <button onClick={() => { void navigator.clipboard?.writeText(qr.url); toast("Link copiado."); }} className="rounded-lg border border-volt-400/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-volt-300">Copiar link</button>
        </div>
      )}
    </Sheet>
  </div>;
}

function RoutineListSkeleton() {
  return (
    <div aria-label="Carregando rotinas" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-3 h-[84px] animate-pulse rounded-2xl border border-ink-700 bg-ink-850" />
      ))}
    </div>
  );
}

const EXPORT_ACTIONS: { kind: ExportKind; label: string; href?: (r: ApiRoutine) => string }[] = [
  { kind: "pdf", label: "PDF" },
  { kind: "png", label: "PNG" },
  { kind: "qr", label: "QR" },
  { kind: "whatsapp", label: "WhatsApp", href: (r) => `https://wa.me/?text=${encodeURIComponent(routineShareText(r))}` },
  { kind: "email", label: "E-mail", href: (r) => `mailto:?subject=${encodeURIComponent(r.name)}&body=${encodeURIComponent(routineShareText(r))}` },
];

const RoutineCard = memo(function RoutineCard({ routine, onStart, onExport }: { routine: ApiRoutine; onStart: () => void; onExport: (kind: ExportKind) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850"><button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4 text-left"><div><h3 className="font-display text-[17px] uppercase text-fog">{routine.name}</h3><p className="mt-1 text-[11px] text-fog-mute">{routine.sportName} · {routine.items.length} exercícios</p></div><span className="text-fog-mute">{open ? "−" : "+"}</span></button>{open && <div className="border-t border-ink-700 p-4"><div className="space-y-2">{routine.items.map((item) => <div key={item.exerciseId} className="flex items-center justify-between rounded-lg bg-ink-800 p-2.5"><div><p className="text-[12px] font-bold text-fog">{item.exerciseName}</p><p className="text-[10px] text-fog-mute">{item.sets} × {item.reps} · descanso {item.restTime}s</p></div></div>)}</div><button onClick={onStart} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-volt-400 py-3 text-[12px] font-bold uppercase tracking-[.1em] text-ink-950"><IconTimer size={15} /> Iniciar sessão</button><div className="mt-2 grid grid-cols-5 gap-1.5">{EXPORT_ACTIONS.map((action) => action.href ? <a key={action.kind} href={action.href(routine)} target={action.kind === "whatsapp" ? "_blank" : undefined} rel={action.kind === "whatsapp" ? "noopener" : undefined} className="rounded-lg border border-ink-600 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300">{action.label}</a> : <button key={action.kind} onClick={() => onExport(action.kind)} className="rounded-lg border border-ink-600 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300">{action.label}</button>)}</div></div>}</div>;
});

function SessionSheet({ session, onClose, onChange }: { session: ApiSession | null; onClose: () => void; onChange: (session: ApiSession | null) => void }) {
  const { token, toast } = useApp();
  const [duration, setDuration] = useState("60");
  const [rpe, setRpe] = useState("6");
  const [saving, setSaving] = useState<number | null>(null);
  const updateItem = async (exerciseId: number, values: { completedSets: string; completedReps: string; loadKg: string; itemRpe: string; painLevel: string }) => {
    if (!token || !session) return;
    setSaving(exerciseId);
    try { onChange(await api.patchSessionItem(token, session.id, exerciseId, { completedSets: Number(values.completedSets), completedReps: values.completedReps, loadKg: Number(values.loadKg || 0), itemRpe: Number(values.itemRpe), painLevel: Number(values.painLevel) })); toast("Exercício registrado."); }
    catch { toast("Não foi possível registrar o exercício."); }
    finally { setSaving(null); }
  };
  const finish = async () => {
    if (!token || !session) return;
    try { await api.patchSession(token, session.id, { status: "COMPLETED", durationMinutes: Number(duration), sessionRpe: Number(rpe) }); invalidate(userCacheKey(token), /progress/); toast("Sessão concluída e salva."); onClose(); }
    catch { toast("Não foi possível concluir a sessão."); }
  };
  return <Sheet open={!!session} onClose={onClose} title={session ? `Executando · ${session.sportName}` : ""}>{session && <div className="space-y-3 pb-4">{session.items.map((item) => <SessionItem key={item.exerciseId} item={item} saving={saving === item.exerciseId} onSave={updateItem} />)}<div className="grid grid-cols-2 gap-3 rounded-xl border border-ink-700 p-3"><label className="text-[11px] text-fog-mute">Duração (min)<input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="1" max="600" className="mt-1 block w-full rounded-lg bg-ink-800 p-2 text-fog outline-none" /></label><label className="text-[11px] text-fog-mute">RPE da sessão<input value={rpe} onChange={(e) => setRpe(e.target.value)} type="number" min="1" max="10" className="mt-1 block w-full rounded-lg bg-ink-800 p-2 text-fog outline-none" /></label></div><button onClick={() => void finish()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-volt-400 py-3 font-bold uppercase text-ink-950"><IconCheck size={16} /> Concluir sessão</button></div>}</Sheet>;
}

function SessionItem({ item, saving, onSave }: { item: ApiSession["items"][number]; saving: boolean; onSave: (exerciseId: number, values: { completedSets: string; completedReps: string; loadKg: string; itemRpe: string; painLevel: string }) => void }) {
  const [values, setValues] = useState({ completedSets: String(item.completedSets ?? item.prescribedSets), completedReps: item.completedReps ?? item.prescribedReps, loadKg: String(item.loadKg ?? ""), itemRpe: String(item.itemRpe ?? 6), painLevel: String(item.painLevel ?? 0) });
  const change = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <div className="rounded-xl border border-ink-700 bg-ink-850 p-3"><p className="font-bold text-fog">{item.exerciseName}</p><p className="mt-0.5 text-[10px] uppercase text-fog-mute">Prescrito: {item.prescribedSets} × {item.prescribedReps}</p><div className="mt-3 grid grid-cols-3 gap-2">{([['completedSets','Séries'],['loadKg','Carga kg'],['itemRpe','RPE'],['painLevel','Dor 0–10']] as const).map(([key,label]) => <label key={key} className="text-[9px] uppercase text-fog-mute">{label}<input value={values[key]} onChange={(e) => change(key,e.target.value)} type="number" min="0" max={key === 'painLevel' || key === 'itemRpe' ? "10" : undefined} className="mt-1 block w-full rounded-lg bg-ink-800 p-2 text-sm text-fog outline-none" /></label>)}</div><label className="mt-2 block text-[9px] uppercase text-fog-mute">Repetições realizadas<input value={values.completedReps} onChange={(e) => change('completedReps',e.target.value)} className="mt-1 block w-full rounded-lg bg-ink-800 p-2 text-sm text-fog outline-none" /></label><button disabled={saving} onClick={() => onSave(item.exerciseId, values)} className="mt-3 w-full rounded-lg border border-volt-400/50 py-2 text-[11px] font-bold uppercase text-volt-300 disabled:opacity-50">{saving ? "Salvando…" : "Registrar exercício"}</button></div>;
}
