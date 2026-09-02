import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIsDesktop } from "../hooks/useMedia";
import { IconMinus, IconPlus, IconX } from "./Icons";

export function ScoreMeter({ score, color, size = "md" }: { score: number; color: string; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1" : "h-1.5";
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label={`Relevância ${score} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`${h} w-[7px] rounded-full transition-colors`}
          style={{ background: i <= score ? color : "rgba(233,238,231,0.12)", height: size === "sm" ? 4 + i : 5 + i * 1.4 }}
        />
      ))}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const desktop = useIsDesktop();
  const panelMotion = desktop
    ? {
        initial: { opacity: 0, y: 28, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.98 },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Fechar"
            className="fixed inset-0 z-40 mx-auto w-full max-w-[430px] bg-ink-950/70 backdrop-blur-[2px] lg:max-w-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            {...panelMotion}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-3xl border-x border-t border-ink-700 bg-ink-850 pb-[max(env(safe-area-inset-bottom),18px)] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] lg:inset-0 lg:my-auto lg:h-fit lg:max-h-[82dvh] lg:w-full lg:max-w-[480px] lg:rounded-3xl lg:border lg:border-ink-600 lg:pb-5 lg:shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink-600 lg:hidden" />
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <h3 className="font-display text-lg uppercase tracking-wide text-fog">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg border border-ink-700 bg-ink-800 p-1.5 text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-400"
                aria-label="Fechar painel"
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="max-h-[62dvh] overflow-y-auto px-5 pt-2 lg:max-h-[64dvh]">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-semibold uppercase tracking-[0.14em] text-fog-mute">{label}</span>
      <div className="flex items-center rounded-lg border border-ink-700 bg-ink-800">
        <button
          className="px-2 py-1 text-fog-dim transition-colors hover:text-volt-400 disabled:opacity-30"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={`Diminuir ${label}`}
        >
          <IconMinus size={13} />
        </button>
        <span className="tabular min-w-[44px] text-center text-[13px] font-bold text-fog">
          {format ? format(value) : value}
        </span>
        <button
          className="px-2 py-1 text-fog-dim transition-colors hover:text-volt-400 disabled:opacity-30"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={`Aumentar ${label}`}
        >
          <IconPlus size={13} />
        </button>
      </div>
    </div>
  );
}

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.24em] text-fog-mute ${className}`}>{children}</p>
  );
}
