import React from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import type { Tab } from "../types";
import { sportById } from "../data/sports";
import {
  IconBolt,
  IconClipboard,
  IconCode,
  IconRadar,
  IconUser,
  SportIcon,
} from "./Icons";

const NAV: { id: Tab; label: string; hint: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "explorar", label: "Explorar", hint: "Feed por relevância", icon: (p) => <IconRadar {...p} /> },
  { id: "rotinas", label: "Rotinas", hint: "Gerador + salvas", icon: (p) => <IconClipboard {...p} /> },
  { id: "projeto", label: "Projeto", hint: "Blueprint técnico", icon: (p) => <IconCode {...p} /> },
  { id: "perfil", label: "Perfil", hint: "Esportes e dados", icon: (p) => <IconUser {...p} /> },
];

export default function Sidebar() {
  const { tab, setTab, setGenFocus, profile } = useApp();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-ink-800 bg-ink-900/90 backdrop-blur-md lg:flex">
      {/* brand */}
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400 text-ink-950 shadow-[0_6px_24px_rgba(212,245,60,0.3)]">
          <IconBolt size={21} strokeWidth={2.3} />
        </span>
        <div>
          <p className="font-display text-xl uppercase leading-none tracking-[0.06em] text-fog">Forja</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-fog-mute">
            treino específico
          </p>
        </div>
      </div>

      {/* nav */}
      <nav className="space-y-1 px-3">
        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                active ? "bg-ink-800" : "hover:bg-ink-850"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-notch"
                  className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-volt-400"
                />
              )}
              <span className={`transition-colors ${active ? "text-volt-400" : "text-fog-mute group-hover:text-fog-dim"}`}>
                {item.icon({ size: 19 })}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-bold ${active ? "text-fog" : "text-fog-dim group-hover:text-fog"}`}>
                  {item.label}
                </span>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-fog-mute">{item.hint}</span>
              </span>
            </motion.button>
          );
        })}
      </nav>

      {/* CTA */}
      <div className="px-5 pt-5">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            setGenFocus(null);
            setTab("rotinas");
            window.setTimeout(
              () =>
                document.getElementById("generator-card")?.scrollIntoView({ behavior: "smooth", block: "center" }),
              80
            );
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-volt-400 py-3 font-display text-sm uppercase tracking-[0.06em] text-ink-950 shadow-[0_8px_26px_rgba(212,245,60,0.28)] transition-shadow hover:shadow-[0_10px_34px_rgba(212,245,60,0.4)]"
        >
          <IconBolt size={16} strokeWidth={2.4} /> Gerar treino do dia
        </motion.button>
      </div>

      {/* focused sports */}
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-fog-mute">No foco</p>
        <div className="mt-3 space-y-1.5">
          {profile.sports.map((id) => {
            const s = sportById(id);
            return (
              <div
                key={id}
                className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-850/70 px-2.5 py-2 transition-colors hover:border-ink-600"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md" style={{ background: `${s.color}1a`, color: s.color }}>
                  <SportIcon id={id} size={15} />
                </span>
                <span className="flex-1 truncate text-[12px] font-bold text-fog-dim">{s.name}</span>
                <span className="h-1.5 w-1.5 rounded-full blink-dot" style={{ background: s.color }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* user */}
      <button
        onClick={() => setTab("perfil")}
        className="m-3 flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850/80 px-3 py-3 text-left transition-colors hover:border-ink-600"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-volt-400/15 font-display text-base text-volt-400 ring-1 ring-volt-400/30">
          {(profile.name || "A")[0].toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold text-fog">{profile.name || "Atleta"}</span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-fog-mute">
            {profile.sports.length} esporte{profile.sports.length === 1 ? "" : "s"} ativo{profile.sports.length === 1 ? "" : "s"}
          </span>
        </span>
      </button>
    </aside>
  );
}
