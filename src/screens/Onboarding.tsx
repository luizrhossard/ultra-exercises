import { useState } from "react";
import { motion } from "framer-motion";
import { SPORTS } from "../data/sports";
import { useApp } from "../store";
import { SportIcon, IconBolt, IconCheck, IconChevron } from "../components/Icons";
import { SectionLabel } from "../components/ui";

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* brand panel — apenas desktop */}
      <aside className="relative hidden overflow-hidden border-r border-ink-800 lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div className="stripes-sport pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400 text-ink-950 shadow-[0_6px_24px_rgba(212,245,60,0.3)]">
            <IconBolt size={21} strokeWidth={2.2} />
          </span>
          <span className="font-display text-2xl uppercase tracking-[0.08em] text-fog">Forja</span>
          <span className="ml-auto rounded-md border border-ink-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fog-mute">
            MVP · v0.1
          </span>
        </div>
        <div className="relative">
          <SectionLabel>Agregador de exercícios por esporte</SectionLabel>
          <h1 className="mt-4 font-display text-[76px] uppercase leading-[0.95] text-fog">
            Treine para
            <br />o <span className="text-volt-400">seu</span>
            <br />
            esporte.
          </h1>
          <p className="mt-6 max-w-[380px] text-[15px] leading-relaxed text-fog-dim">
            Cada exercício da base tem uma <strong className="text-fog">relevância de 1 a 5</strong> para
            cada modalidade. Escolha o que você pratica — a gente ordena tudo pelo que mais
            transfere pro seu jogo.
          </p>
          <div className="mt-8 flex gap-3">
            {[
              { v: "22", l: "Exercícios" },
              { v: "8", l: "Esportes" },
              { v: "92", l: "Mapeamentos" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-ink-700 bg-ink-850/80 px-4 py-3">
                <p className="tabular font-display text-2xl leading-none text-volt-400">{s.v}</p>
                <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-fog-mute">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/70 px-2.5 py-1.5 text-[11px] font-bold text-fog-dim"
            >
              <span style={{ color: s.color }}>
                <SportIcon id={s.id} size={14} />
              </span>
              {s.name}
            </span>
          ))}
        </div>
      </aside>

      {/* fluxo (mobile intacto, desktop à direita) */}
      <div className="flex flex-1 flex-col px-5 pb-8 lg:justify-center lg:px-14 lg:py-12">
      {/* ticker */}
      <div className="-mx-5 mt-4 overflow-hidden border-y border-ink-700 bg-ink-850 py-2 lg:hidden">
        <div className="ticker-track flex w-max items-center gap-6">
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center gap-6">
              {SPORTS.map((s) => (
                <span key={s.id + k} className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-fog-dim">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* wordmark */}
      <div className="mt-6 flex items-center gap-2.5 lg:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-400 text-ink-950">
          <IconBolt size={20} strokeWidth={2.2} />
        </span>
        <span className="font-display text-xl uppercase tracking-[0.08em] text-fog">Forja</span>
        <span className="ml-auto rounded-md border border-ink-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-fog-mute">
          MVP · v0.1
        </span>
      </div>

      {/* headline */}
      <header className="mt-10 lg:hidden">
        <SectionLabel>Agregador de exercícios por esporte</SectionLabel>
        <h1 className="mt-3 font-display text-[44px] leading-[0.98] uppercase text-fog">
          Treine para
          <br />
          o <span className="text-volt-400">seu</span> esporte.
        </h1>
        <p className="mt-4 max-w-[320px] text-[15px] leading-relaxed text-fog-dim">
          Cada exercício da base tem uma <strong className="text-fog">relevância de 1 a 5</strong> para
          cada modalidade. Escolha o que você pratica — a gente ordena tudo pelo que mais
          transfere pro seu jogo.
        </p>
      </header>

      {/* sport picker */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <SectionLabel>01 · Seus esportes</SectionLabel>
          <span className="tabular text-[12px] font-bold text-volt-400">
            {selected.length} selecionado{selected.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {SPORTS.map((s, i) => {
            const on = selected.includes(s.id);
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.35, ease: "easeOut" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => toggle(s.id)}
                className="relative rounded-xl border p-3.5 text-left transition-colors"
                style={{
                  borderColor: on ? s.color : "#1f2a32",
                  background: on ? `${s.color}14` : "#10161b",
                }}
                aria-pressed={on}
              >
                <span
                  className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full transition-all ${
                    on ? "scale-100" : "scale-0"
                  }`}
                  style={{ background: s.color, color: "#0c1013" }}
                >
                  <IconCheck size={12} strokeWidth={2.6} />
                </span>
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{ background: `${s.color}1f`, color: s.color }}
                >
                  <SportIcon id={s.id} size={22} />
                </span>
                <p className="mt-2.5 font-display text-[15px] uppercase tracking-wide text-fog">{s.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-fog-mute">{s.tag}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* name */}
      <div className="mt-8">
        <SectionLabel>02 · Como te chamamos? (opcional)</SectionLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="Seu nome ou apelido"
          className="mt-3 w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-[15px] text-fog placeholder:text-fog-mute focus:border-volt-400 focus:outline-none"
        />
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 mt-10 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent pb-1 pt-6 lg:static lg:mt-8 lg:bg-none lg:pt-0">
        <motion.button
          whileTap={selected.length ? { scale: 0.97 } : undefined}
          disabled={selected.length === 0 || saving}
          onClick={async () => {
            setSaving(true); setError("");
            try { await completeOnboarding(name.trim(), selected); }
            catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar seu perfil."); }
            finally { setSaving(false); }
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-lg uppercase tracking-[0.06em] transition-all ${
            selected.length
              ? "bg-volt-400 text-ink-950 shadow-[0_14px_40px_rgba(212,245,60,0.3)]"
              : "cursor-not-allowed bg-ink-700 text-fog-mute"
          }`}
        >
          {saving ? "Salvando…" : "Entrar na arena"}
          <IconChevron size={20} strokeWidth={2.2} />
        </motion.button>
        <p className="mt-2.5 text-center text-[11px] text-fog-mute">
          Mínimo de 1 esporte · dados salvos localmente neste protótipo
        </p>
      </div>
      </div>
    </div>
  );
}
