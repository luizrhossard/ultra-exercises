import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { exerciseById } from "../data/exercises";
import { sportById } from "../data/sports";
import { CATEGORY_ACCENT, MUSCLE_LABEL } from "../types";
import { useApp } from "../store";
import MuscleMap from "../components/MuscleMap";
import { ScoreMeter, SectionLabel } from "../components/ui";
import {
  SportIcon,
  IconBack,
  IconPlay,
  IconPause,
  IconTimer,
  IconDumbbell,
  IconBolt,
  IconFlame,
} from "../components/Icons";

const FALLBACK_WHY: Record<string, string> = {
  "Força": "Base de força que sustenta os gestos repetidos do seu esporte com menos fadiga e menos lesão.",
  Pliometria: "Ensina o sistema nervoso a aplicar força em pouco tempo — exatamente o que o gesto esportivo exige.",
  Core: "Tronco rígido transfere a força das pernas para os braços sem vazamento de energia.",
  Condicionamento: "Replica a relação esforço × pausa do jogo, para você manter a intensidade até o fim.",
  Mobilidade: "Amplitude de movimento que deixa o gesto técnico mais eficiente e o corpo mais difícil de lesionar.",
  "Específico": "Padrão de movimento espelhado do próprio esporte — transferência quase direta.",
};

export default function Player() {
  const { playerId, closePlayer, profile, toast } = useApp();
  const ex = playerId ? exerciseById(playerId) : undefined;
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [reps, setReps] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setReps(0);
  }, [playerId]);

  useEffect(() => {
    if (!playing || reduced) return;
    const t = window.setInterval(() => setReps((r) => (r >= 10 ? 0 : r + 1)), 1600);
    return () => window.clearInterval(t);
  }, [playing, reduced]);

  if (!ex) return null;

  const myLinks = ex.links
    .filter((l) => profile.sports.includes(l.sport))
    .sort((a, b) => b.score - a.score);
  const accent = CATEGORY_ACCENT[ex.category];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-30 hidden bg-ink-950/75 backdrop-blur-sm lg:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closePlayer}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 80 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        role="dialog"
        aria-modal="true"
        aria-label={ex.name}
        className="fixed inset-0 z-40 mx-auto w-full max-w-[430px] overflow-y-auto bg-ink-900 lg:my-auto lg:h-fit lg:max-h-[90dvh] lg:max-w-[880px] lg:rounded-3xl lg:border lg:border-ink-600 lg:shadow-[0_50px_140px_rgba(0,0,0,0.65)]"
      >
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={closePlayer}
          className="grid h-9 w-9 place-items-center rounded-xl border border-ink-700 bg-ink-850 text-fog transition-colors hover:border-volt-400"
          aria-label="Voltar para o feed"
        >
          <IconBack size={18} />
        </button>
        <span
          className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ background: `${accent}1c`, color: accent }}
        >
          {ex.category}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= ex.level ? "bg-volt-400" : "bg-ink-600"}`} />
          ))}
        </span>
      </div>

      <div className="px-5 pb-36 pt-5 lg:px-9 lg:pb-2 lg:pt-8">
        <h1 className="font-display text-[34px] uppercase leading-[1.02] text-fog lg:text-[46px]">{ex.name}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fog-dim">
          <span className="flex items-center gap-1.5">
            <IconDumbbell size={14} /> {ex.equipment}
          </span>
          <span className="flex items-center gap-1.5">
            <IconTimer size={14} /> Cadência {ex.tempo}
          </span>
        </div>

        {/* demo panel */}
        <div className="stripes-sport relative mt-5 overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 p-5">
          <div className="flex items-center gap-5">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="ring-pulse absolute inset-0 rounded-full border"
                  style={{
                    borderColor: `${accent}66`,
                    animationDelay: `${i * 0.8}s`,
                    animationPlayState: playing && !reduced ? "running" : "paused",
                    opacity: playing || reduced ? undefined : 0.35,
                  }}
                />
              ))}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setPlaying((p) => !p)}
                className="grid h-16 w-16 place-items-center rounded-full text-ink-950 shadow-lg"
                style={{ background: accent }}
                aria-label={playing ? "Pausar demonstração" : "Reproduzir demonstração"}
              >
                {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
              </motion.button>
            </div>
            <div className="min-w-0">
              <SectionLabel>Demonstração em loop</SectionLabel>
              <p className="tabular mt-1 font-display text-3xl uppercase text-fog">
                {String(playing ? reps : 0).padStart(2, "0")}
                <span className="text-fog-mute">/10</span>
              </p>
              <p className="mt-1 text-[11px] text-fog-dim">
                {playing ? "Ciclo de repetições em andamento" : "Toque para iniciar o ciclo"}
              </p>
            </div>
          </div>
          {/* cadence track */}
          <div className="mt-4">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-fog-mute">
              <span>Excêntrica</span>
              <span>Pause</span>
              <span>Concêntrica</span>
            </div>
            <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-ink-700">
              <span
                className="cadence-dot absolute left-0 top-0 h-2 w-[26px] rounded-full"
                style={{ background: accent, animationPlayState: playing && !reduced ? "running" : "paused" }}
              />
            </div>
          </div>
        </div>

        <div className="mt-7 lg:mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-7">
        {/* why it helps */}
        <section className="lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-2">
            <span className="text-volt-400"><IconFlame size={16} /></span>
            <SectionLabel>Por que ajuda no seu jogo</SectionLabel>
          </div>
          {myLinks.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {myLinks.map((l) => {
                const s = sportById(l.sport);
                return (
                  <motion.div
                    key={l.sport}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border p-4"
                    style={{ borderColor: `${s.color}44`, background: `${s.color}0d` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-display text-[15px] uppercase tracking-wide" style={{ color: s.color }}>
                        <SportIcon id={s.id} size={17} /> {s.name}
                      </span>
                      <ScoreMeter score={l.score} color={s.color} size="sm" />
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-fog-dim">
                      {l.why ?? FALLBACK_WHY[ex.category]}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-ink-600 p-4 text-[13px] text-fog-mute">
              Nenhum dos seus esportes tem mapeamento direto — mas a base muscular continua valendo.
            </p>
          )}
        </section>

        {/* muscle map */}
        <section className="mt-7 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mt-0 lg:self-start">
          <SectionLabel>Músculos trabalhados</SectionLabel>
          <div className="mt-3">
            <MuscleMap muscles={ex.muscles} />
          </div>
        </section>

        {/* steps */}
        <section className="mt-7 lg:col-start-1 lg:row-start-2">
          <SectionLabel>Passo a passo</SectionLabel>
          <ol className="mt-3 space-y-2.5">
            {ex.steps.map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex gap-3.5 rounded-xl border border-ink-700 bg-ink-850 p-3.5"
              >
                <span className="font-display text-2xl leading-none" style={{ color: accent }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="pt-0.5 text-[13px] leading-relaxed text-fog-dim">{step}</p>
              </motion.li>
            ))}
          </ol>
        </section>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-fog-mute lg:mt-8">
          <IconBolt size={12} strokeWidth={2.2} />
          Relevância máxima aqui: {myLinks[0] ? `${myLinks[0].score}/5 para ${sportById(myLinks[0].sport).name}` : "—"}
        </p>
      </div>

      </motion.div>
    </>
  );
}
