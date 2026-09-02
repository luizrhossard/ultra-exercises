import { motion } from "framer-motion";
import { useApp } from "../store";
import type { Tab } from "../types";
import { IconBolt, IconClipboard, IconRadar, IconTrend, IconUser } from "./Icons";

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "explorar", label: "Explorar", icon: (p) => <IconRadar {...p} /> },
  { id: "rotinas", label: "Rotinas", icon: (p) => <IconClipboard {...p} /> },
  { id: "progresso", label: "Progresso", icon: (p) => <IconTrend {...p} /> },
  { id: "perfil", label: "Perfil", icon: (p) => <IconUser {...p} /> },
];

export default function BottomNav() {
  const { tab, setTab, setGenFocus } = useApp();

  const go = (t: Tab) => setTab(t);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-ink-700 bg-ink-900/92 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-md">
      <div className="grid grid-cols-5 items-end px-2">
        {TABS.slice(0, 2).map((t) => (
          <NavBtn key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}

        <div className="flex justify-center">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setGenFocus(null);
              go("rotinas");
              window.setTimeout(
                () => document.getElementById("generator-card")?.scrollIntoView({ behavior: "smooth", block: "center" }),
                60
              );
            }}
            aria-label="Gerar treino do dia"
            className="relative -mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-volt-400 text-ink-950 shadow-[0_10px_30px_rgba(212,245,60,0.35)]"
          >
            <IconBolt size={26} strokeWidth={2} />
            <span className="absolute -bottom-4 text-[8px] font-bold uppercase tracking-[0.18em] text-volt-400">
              Gerar
            </span>
          </motion.button>
        </div>

        {TABS.slice(2).map((t) => (
          <NavBtn key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavBtn({
  t,
  active,
  onClick,
}: {
  t: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 py-1"
      aria-label={t.label}
    >
      {active && (
        <motion.span
          layoutId="nav-notch"
          className="absolute -top-2 h-[3px] w-8 rounded-full bg-volt-400"
        />
      )}
      <span className={`transition-colors ${active ? "text-volt-400" : "text-fog-mute"}`}>{t.icon({ size: 21 })}</span>
      <span
        className={`text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
          active ? "text-fog" : "text-fog-mute"
        }`}
      >
        {t.label}
      </span>
    </motion.button>
  );
}
