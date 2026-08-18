import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { AppProvider, useApp } from "./store";
import BottomNav from "./components/BottomNav";
import { Sheet } from "./components/ui";
import { IconBolt, IconCheck, IconClipboard } from "./components/Icons";
import { exerciseById } from "./data/exercises";
import { sportById } from "./data/sports";
import Onboarding from "./screens/Onboarding";
import Feed from "./screens/Feed";
import Player from "./screens/Player";
import Routines from "./screens/Routines";
import Project from "./screens/Project";
import Profile from "./screens/Profile";

function AddSheet() {
  const { addFor, closeAdd, routines, addToRoutine, saveRoutine, toast, profile, setTab } = useApp();
  const ex = addFor ? exerciseById(addFor) : null;

  const createNew = () => {
    if (!ex) return;
    const best =
      ex.links
        .filter((l) => profile.sports.includes(l.sport))
        .sort((a, b) => b.score - a.score)[0]?.sport ?? profile.sports[0];
    const s = sportById(best);
    const dt = new Date();
    const name = `Treino rápido · ${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const r = { id: uuidv4(), name, sportId: best, createdAt: Date.now(), items: [] };
    saveRoutine(r);
    addToRoutine(r.id, ex.id);
    toast(`Rotina "${name}" criada`, s.color);
    closeAdd();
    setTab("rotinas");
  };

  return (
    <Sheet open={!!ex} onClose={closeAdd} title={ex ? `Adicionar · ${ex.name}` : ""}>
      <div className="space-y-2 pb-4">
        <button
          onClick={createNew}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-volt-400/50 bg-volt-400/8 p-3 text-left transition-colors hover:bg-volt-400/14"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-volt-400 text-ink-950">
            <IconBolt size={17} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[13px] font-bold text-volt-300">Nova rotina com este exercício</p>
            <p className="text-[11px] text-fog-mute">Cria um treino rápido focado no esporte com maior relevância</p>
          </div>
        </button>

        {routines.map((r) => {
          const s = sportById(r.sportId);
          const has = r.items.some((it) => it.exerciseId === ex?.id);
          return (
            <button
              key={r.id}
              disabled={has}
              onClick={() => {
                if (!ex) return;
                addToRoutine(r.id, ex.id);
                toast(`Adicionado a "${r.name}"`, s.color);
                closeAdd();
              }}
              className={`flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3 text-left transition-colors ${
                has ? "opacity-50" : "hover:border-ink-500"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${s.color}18`, color: s.color }}>
                <IconClipboard size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-fog">{r.name}</p>
                <p className="text-[11px] text-fog-mute">
                  {r.items.length} exercício{r.items.length === 1 ? "" : "s"} · {s.name}
                </p>
              </div>
              {has ? (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-volt-400">
                  <IconCheck size={12} strokeWidth={2.6} /> Na lista
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-fog-mute">Adicionar</span>
              )}
            </button>
          );
        })}

        {routines.length === 0 && (
          <p className="py-2 text-center text-[11px] text-fog-mute">
            Nenhuma rotina salva — crie uma acima.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-full max-w-[430px] flex-col items-center gap-2 px-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-ink-950 shadow-[0_12px_36px_rgba(0,0,0,0.45)]"
            style={{ background: t.color ?? "#d4f53c" }}
          >
            <IconBolt size={14} strokeWidth={2.4} />
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Shell() {
  const { profile, tab, playerId } = useApp();

  return (
    <div className="noise relative min-h-dvh">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="glow-drift absolute -top-24 left-[8%] h-80 w-80 rounded-full bg-[rgba(212,245,60,0.07)] blur-3xl" />
        <div className="glow-drift-slow absolute right-[4%] top-1/3 h-96 w-96 rounded-full bg-[rgba(52,217,123,0.06)] blur-3xl" />
        <div className="glow-drift absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-[rgba(255,81,72,0.05)] blur-3xl" />
      </div>

      {/* desktop side flourishes */}
      <p
        className="fixed left-6 top-1/2 z-0 hidden -translate-y-1/2 font-display text-sm uppercase tracking-[0.5em] text-fog-mute/50 xl:block"
        style={{ writingMode: "vertical-rl" }}
      >
        Forja® — treino específico por esporte
      </p>
      <p
        className="fixed right-6 top-1/2 z-0 hidden -translate-y-1/2 rotate-180 font-display text-sm uppercase tracking-[0.5em] text-fog-mute/50 xl:block"
        style={{ writingMode: "vertical-rl" }}
      >
        exercise × sport · relevance 1–5
      </p>

      {/* app column */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col border-x border-ink-800 bg-ink-900/70 backdrop-blur-sm">
        {!profile.onboarded ? (
          <Onboarding />
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.main
                key={tab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="flex-1"
              >
                {tab === "explorar" && <Feed />}
                {tab === "rotinas" && <Routines />}
                {tab === "projeto" && <Project />}
                {tab === "perfil" && <Profile />}
              </motion.main>
            </AnimatePresence>
            <BottomNav />
          </>
        )}
      </div>

      <AnimatePresence>{playerId && profile.onboarded && <Player key="player" />}</AnimatePresence>
      <AddSheet />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <Shell />
      </AppProvider>
    </MotionConfig>
  );
}
