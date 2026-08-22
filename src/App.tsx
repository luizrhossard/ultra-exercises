import { lazy, Suspense } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AppProvider, useApp } from "./store";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { IconBolt } from "./components/Icons";

const Auth = lazy(() => import("./screens/Auth"));
const Onboarding = lazy(() => import("./screens/Onboarding"));
const Feed = lazy(() => import("./screens/Feed"));
const Routines = lazy(() => import("./screens/Routines"));
const Profile = lazy(() => import("./screens/Profile"));
const Player = lazy(() => import("./screens/Player"));

function ScreenFallback() {
  return (
    <div className="grid min-h-[40dvh] place-items-center">
      <span role="status" aria-label="Carregando" className="tabular font-display text-lg uppercase tracking-[0.2em] text-volt-400">
        Carregando…
      </span>
    </div>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-full max-w-[430px] flex-col items-center gap-2 px-6 lg:bottom-8 lg:max-w-none">
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
  const { profile, tab, playerId, token, authLoading } = useApp();

  return (
    <div className="noise relative min-h-dvh">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="glow-drift absolute -top-24 left-[8%] h-80 w-80 rounded-full bg-[rgba(212,245,60,0.07)] blur-3xl" />
        <div className="glow-drift-slow absolute right-[4%] top-1/3 h-96 w-96 rounded-full bg-[rgba(52,217,123,0.06)] blur-3xl" />
        <div className="glow-drift absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-[rgba(255,81,72,0.05)] blur-3xl" />
      </div>

      {/* desktop side flourish */}
      <p
        className="fixed right-6 top-1/2 z-0 hidden -translate-y-1/2 rotate-180 font-display text-sm uppercase tracking-[0.5em] text-fog-mute/50 xl:block"
        style={{ writingMode: "vertical-rl" }}
      >
        exercise × sport · relevance 1–5
      </p>

      {token && <Sidebar />}

      {/* app column */}
      <div className={`relative z-10 ${token ? "lg:pl-[260px]" : ""}`}>
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col border-x border-ink-800 bg-ink-900/70 backdrop-blur-sm lg:max-w-[1120px] lg:bg-ink-900/50">
        {authLoading ? <div className="grid min-h-dvh place-items-center font-display text-xl uppercase text-volt-400">Carregando…</div> : !token ? (
          <Suspense fallback={<ScreenFallback />}><Auth /></Suspense>
        ) : !profile.onboarded ? (
          <Suspense fallback={<ScreenFallback />}><Onboarding /></Suspense>
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
                <Suspense fallback={<ScreenFallback />}>
                  {tab === "explorar" && <Feed />}
                  {tab === "rotinas" && <Routines />}
                  {tab === "perfil" && <Profile />}
                </Suspense>
              </motion.main>
            </AnimatePresence>
            <div className="lg:hidden">
              <BottomNav />
            </div>
          </>
        )}
      </div>
      </div>

      <AnimatePresence>
        {playerId && profile.onboarded && (
          <Suspense fallback={<ScreenFallback />}>
            <Player key={playerId} />
          </Suspense>
        )}
      </AnimatePresence>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </AppProvider>
    </MotionConfig>
  );
}
