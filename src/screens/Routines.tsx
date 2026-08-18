import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EXERCISES, exerciseById, rankFor } from "../data/exercises";
import { sportById } from "../data/sports";
import { generateRoutine, useApp } from "../store";
import type { Routine } from "../types";
import {
  SportIcon,
  IconBolt,
  IconTrash,
  IconChevron,
  IconPlus,
  IconTimer,
  IconLayers,
  IconRefresh,
} from "../components/Icons";
import { Sheet, Stepper } from "../components/ui";

export default function Routines() {
  const { profile, routines, saveRoutine, deleteRoutine, updateItem, removeItem, addToRoutine, toast, genFocus } = useApp();
  const [focus, setFocus] = useState<string>(genFocus ?? profile.sports[0]);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (genFocus) setFocus(genFocus);
  }, [genFocus]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const onGenerate = () => {
    if (generating) return;
    setGenerating(true);
    timer.current = window.setTimeout(() => {
      const r = generateRoutine(focus, profile.sports);
      saveRoutine(r);
      setExpanded(r.id);
      setGenerating(false);
      toast(`Rotina criada com ${r.items.length} exercícios`, sportById(focus).color);
    }, 700);
  };

  const focusSport = sportById(focus);

  return (
    <div className="px-5 pb-32 pt-6 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="lg:sticky lg:top-8">
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-[40px] uppercase leading-none text-fog lg:text-[56px]"
      >
        Rotinas
      </motion.h1>
      <p className="mt-2 text-[13px] text-fog-dim">
        Monte o treino do dia a partir dos exercícios mais relevantes para o seu esporte.
      </p>

      {/* generator */}
      <div id="generator-card" className="stripes relative mt-5 overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-400 text-ink-950">
            <IconBolt size={17} strokeWidth={2.2} />
          </span>
          <h2 className="font-display text-xl uppercase tracking-wide text-fog">Treino do dia</h2>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-fog-dim">
          O gerador cruza a tabela <span className="text-fog-mute">exercise_sport</span> com seus esportes,
          prioriza a relevância do foco e equilibra categorias: 2× força, 1× pliometria, core,
          condicionamento e complemento.
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {profile.sports.map((id) => {
            const s = sportById(id);
            const on = focus === id;
            return (
              <button
                key={id}
                onClick={() => setFocus(id)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all"
                style={{
                  borderColor: on ? s.color : "#1f2a32",
                  background: on ? `${s.color}18` : "transparent",
                  color: on ? s.color : "#9aa9a2",
                }}
              >
                <SportIcon id={id} size={13} /> {s.name}
              </button>
            );
          })}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onGenerate}
          disabled={generating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-volt-400 py-3.5 font-display text-base uppercase tracking-[0.05em] text-ink-950 shadow-[0_10px_30px_rgba(212,245,60,0.28)] disabled:opacity-70"
        >
          {generating ? (
            <>
              <IconRefresh size={18} className="animate-spin" strokeWidth={2.2} /> Cruzando relevâncias…
            </>
          ) : (
            <>
              <IconBolt size={18} strokeWidth={2.4} /> Gerar para {focusSport.name}
            </>
          )}
        </motion.button>
      </div>

      </div>

      <div className="lg:min-w-0">
      {/* saved routines */}
      <div className="mt-7 flex items-baseline justify-between lg:mt-0">
        <h2 className="font-display text-xl uppercase tracking-wide text-fog">Salvas</h2>
        <span className="tabular text-[12px] font-bold text-fog-mute">{routines.length} rotina{routines.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-3 space-y-3">
        {routines.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-600 p-8 text-center">
            <p className="font-display text-lg uppercase text-fog-dim">Nenhuma rotina ainda</p>
            <p className="mx-auto mt-1 max-w-[260px] text-[12px] text-fog-mute">
              Gere o treino do dia acima ou adicione exercícios pelo player.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              r={r}
              expanded={expanded === r.id}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              onDelete={() => {
                if (confirmDelete === r.id) {
                  deleteRoutine(r.id);
                  setConfirmDelete(null);
                  toast("Rotina excluída");
                } else {
                  setConfirmDelete(r.id);
                  window.setTimeout(() => setConfirmDelete((c) => (c === r.id ? null : c)), 2600);
                }
              }}
              confirming={confirmDelete === r.id}
              onUpdate={updateItem}
              onRemove={(exId) => {
                removeItem(r.id, exId);
                toast("Exercício removido");
              }}
              onPick={() => setPickerFor(r.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      </div>

      {/* exercise picker for a routine */}
      <Sheet open={!!pickerFor} onClose={() => setPickerFor(null)} title="Adicionar exercício">
        {pickerFor && (
          <ExercisePicker
            sportId={routines.find((r) => r.id === pickerFor)?.sportId ?? profile.sports[0]}
            excluded={routines.find((r) => r.id === pickerFor)?.items.map((i) => i.exerciseId) ?? []}
            onPick={(exId) => {
              addToRoutine(pickerFor, exId);
              toast("Adicionado à rotina", sportById(routines.find((r) => r.id === pickerFor)?.sportId ?? "futebol").color);
              setPickerFor(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function RoutineCard({
  r,
  expanded,
  onToggle,
  onDelete,
  confirming,
  onUpdate,
  onRemove,
  onPick,
}: {
  r: Routine;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  confirming: boolean;
  onUpdate: (routineId: string, exerciseId: string, patch: { sets?: number; rest?: number }) => void;
  onRemove: (exerciseId: string) => void;
  onPick: () => void;
}) {
  const s = sportById(r.sportId);
  const totalSets = r.items.reduce((a, i) => a + i.sets, 0);
  const date = new Date(r.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850"
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[16px] uppercase tracking-wide text-fog">{r.name}</h3>
          <p className="mt-0.5 flex items-center gap-3 text-[11px] text-fog-mute">
            <span className="tabular">{r.items.length} exercícios</span>
            <span className="tabular">{totalSets} séries totais</span>
            <span className="tabular">{date}</span>
          </p>
        </div>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} className="text-fog-mute">
          <IconChevron size={17} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-ink-700 p-4 pt-3">
              {r.items.map((it, idx) => {
                const ex = exerciseById(it.exerciseId);
                if (!ex) return null;
                return (
                  <div key={it.exerciseId} className="rounded-xl border border-ink-700 bg-ink-800 p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular font-display text-lg text-fog-mute">{String(idx + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-fog">{ex.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-fog-mute">
                          {ex.category} · {it.reps}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemove(it.exerciseId)}
                        className="rounded-lg p-1.5 text-fog-mute transition-colors hover:bg-ink-700 hover:text-[#ff5148]"
                        aria-label={`Remover ${ex.name}`}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Stepper
                        label="Séries"
                        value={it.sets}
                        min={1}
                        max={6}
                        onChange={(v) => onUpdate(r.id, it.exerciseId, { sets: v })}
                      />
                      <Stepper
                        label="Descanso"
                        value={it.rest}
                        min={15}
                        max={300}
                        step={15}
                        format={(v) => `${v}s`}
                        onChange={(v) => onUpdate(r.id, it.exerciseId, { rest: v })}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onPick}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-600 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-400"
                >
                  <IconPlus size={14} strokeWidth={2.4} /> Exercício
                </button>
                <button
                  onClick={onDelete}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${
                    confirming
                      ? "bg-[#ff5148] text-ink-950"
                      : "border border-ink-600 text-fog-mute hover:border-[#ff5148] hover:text-[#ff5148]"
                  }`}
                >
                  <IconTrash size={14} /> {confirming ? "Confirmar?" : "Excluir"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ExercisePicker({
  sportId,
  excluded,
  onPick,
}: {
  sportId: string;
  excluded: string[];
  onPick: (id: string) => void;
}) {
  const { profile } = useApp();
  const list = useMemo(
    () =>
      EXERCISES.filter((ex) => rankFor(ex, profile.sports) > 0 && !excluded.includes(ex.id))
        .sort(
          (a, b) =>
            (b.links.find((l) => l.sport === sportId)?.score ?? 0) -
              (a.links.find((l) => l.sport === sportId)?.score ?? 0) ||
            rankFor(b, profile.sports) - rankFor(a, profile.sports)
        )
        .slice(0, 10),
    [profile.sports, sportId, excluded]
  );
  const s = sportById(sportId);

  return (
    <div className="space-y-2 pb-4">
      <p className="text-[11px] text-fog-mute">
        Ordenados pela relevância para <span style={{ color: s.color }} className="font-bold">{s.name}</span>.
      </p>
      {list.map((ex) => {
        const link = ex.links.find((l) => l.sport === sportId);
        return (
          <button
            key={ex.id}
            onClick={() => onPick(ex.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3 text-left transition-colors hover:border-ink-500"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${s.color}18`, color: s.color }}>
              <IconLayers size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-fog">{ex.name}</p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-fog-mute">{ex.category} · {ex.equipment}</p>
            </div>
            {link ? (
              <span className="tabular shrink-0 text-[12px] font-bold" style={{ color: s.color }}>
                {link.score}/5
              </span>
            ) : (
              <span className="shrink-0 text-[10px] text-fog-mute">apoio</span>
            )}
          </button>
        );
      })}
      {list.length === 0 && (
        <p className="py-6 text-center text-[12px] text-fog-mute">Todos os exercícios relevantes já estão na rotina.</p>
      )}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-[10px] uppercase tracking-[0.16em] text-fog-mute">
        <IconTimer size={12} /> Séries e descanso ajustáveis depois
      </p>
    </div>
  );
}
