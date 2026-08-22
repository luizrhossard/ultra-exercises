import { useState } from "react";
import { motion } from "framer-motion";
import { EXERCISES } from "../data/exercises";
import { SPORTS, sportById } from "../data/sports";
import { useApp } from "../store";
import { SportIcon, IconBolt, IconCheck } from "../components/Icons";
import { SectionLabel } from "../components/ui";
import ReadinessCard from "../components/ReadinessCard";
import TwoFactorSettings from "../components/TwoFactorSettings";

export default function Profile() {
  const { profile, setName, toggleSport, resetAll, toast } = useApp();
  const [name, setNameLocal] = useState(profile.name);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="px-5 pb-32 pt-6 lg:mx-auto lg:max-w-4xl lg:px-10 lg:pb-24 lg:pt-10">
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-[40px] uppercase leading-none text-fog lg:text-[56px]"
      >
        Perfil
      </motion.h1>

      {/* identity */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-volt-400 font-display text-2xl text-ink-950">
          {(profile.name || "A")[0].toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setNameLocal(e.target.value)}
            maxLength={24}
            placeholder="Seu nome"
            className="w-full border-b border-transparent bg-transparent font-display text-xl uppercase tracking-wide text-fog placeholder:text-fog-mute focus:border-volt-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-fog-mute">
            Atleta · {profile.sports.length} esporte{profile.sports.length === 1 ? "" : "s"}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            setName(name.trim());
            toast("Nome atualizado");
          }}
          className="rounded-lg bg-ink-700 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-volt-400 transition-colors hover:bg-ink-600"
        >
          Salvar
        </motion.button>
      </div>

      <ReadinessCard />

      {/* stats */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {[
          { v: EXERCISES.length, l: "Exercícios na base" },
          { v: profile.sports.length, l: "Esportes ativos" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-ink-700 bg-ink-850 p-3.5 text-center">
            <p className="tabular font-display text-3xl text-volt-400">{s.v}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fog-mute">{s.l}</p>
          </div>
        ))}
      </div>

      {/* sports manager */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Meus esportes</SectionLabel>
          <span className="text-[10px] text-fog-mute">mínimo 1 ativo</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {SPORTS.map((s) => {
            const on = profile.sports.includes(s.id);
            return (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  toggleSport(s.id);
                  toast(on ? `${s.name} removido do foco` : `${s.name} adicionado ao foco`, on ? undefined : s.color);
                }}
                className="flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: on ? `${s.color}55` : "#1f2a32",
                  background: on ? `${s.color}0f` : "#10161b",
                }}
                aria-pressed={on}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${s.color}1c`, color: s.color }}>
                  <SportIcon id={s.id} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-bold ${on ? "text-fog" : "text-fog-mute"}`}>{s.name}</p>
                  <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: on ? s.color : "#61716a" }}>
                    {on ? "No foco" : "Inativo"}
                  </p>
                </div>
                {on && <span style={{ color: s.color }}><IconCheck size={15} strokeWidth={2.4} /></span>}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* security: two-factor authentication [UE-24] */}
      <TwoFactorSettings />

      {/* how relevance works */}
      <section className="mt-7 rounded-2xl border border-ink-700 bg-ink-850 p-4">
        <div className="flex items-center gap-2">
          <span className="text-volt-400"><IconBolt size={15} strokeWidth={2.2} /></span>
          <SectionLabel>Como a relevância funciona</SectionLabel>
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-fog-dim">
          Cada par <span className="text-fog">exercício × esporte</span> carrega um{" "}
          <span className="text-volt-300">relevance_score de 1 a 5</span>. O feed ordena pelo maior
          score entre os seus esportes (com desempate por quantas modalidades se beneficiam), e o
          gerador de rotinas pondera o esporte foco em dobro.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.sports.map((id) => {
            const s = sportById(id);
            return (
              <span key={id} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: `${s.color}14`, color: s.color }}>
                <SportIcon id={id} size={12} /> {s.demands[0]}
              </span>
            );
          })}
        </div>
      </section>

      {/* danger zone */}
      <section className="mt-7">
        <SectionLabel>Zona de risco</SectionLabel>
        <div className="mt-3 rounded-xl border border-ink-700 p-4">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-xl border border-ink-600 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-fog-mute transition-colors hover:border-[#ff5148] hover:text-[#ff5148]"
            >
              Resetar app (onboarding + rotinas)
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetAll();
                }}
                className="flex-1 rounded-xl bg-[#ff5148] py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-950"
              >
                Confirmar reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl border border-ink-600 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-fog-dim"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-fog-mute">
          Ultra Exercises · MVP navegável · dados locais
        </p>
      </section>
    </div>
  );
}
