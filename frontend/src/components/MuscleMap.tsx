import React from "react";
import type { MuscleKey } from "../types";
import { MUSCLE_LABEL } from "../types";

const ACTIVE = "#d4f53c";
const BASE = "#24323c";

function Mirror({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="translate(120 0) scale(-1 1)">{children}</g>
    </>
  );
}

function BodyBase() {
  return (
    <g fill={BASE}>
      <circle cx="60" cy="20" r="13" />
      <rect x="55" y="31" width="10" height="11" rx="3" />
      <rect x="39" y="40" width="42" height="74" rx="15" />
      <rect x="41" y="110" width="38" height="26" rx="11" />
      <Mirror>
        <circle cx="36" cy="47" r="9" />
        <rect x="26.5" y="54" width="12" height="36" rx="6" />
        <rect x="27" y="90" width="11" height="34" rx="5.5" />
        <circle cx="32.5" cy="129" r="4.5" />
        <rect x="43.5" y="134" width="15.5" height="46" rx="7.5" />
        <rect x="44.5" y="182" width="13" height="44" rx="6.5" />
        <rect x="42" y="228" width="18" height="8" rx="4" />
      </Mirror>
    </g>
  );
}

const FRONT_ZONES: Partial<Record<MuscleKey, React.ReactNode>> = {
  peitoral: <rect x="41.5" y="45" width="16.5" height="14" rx="7" />,
  biceps: <rect x="28.5" y="57" width="8" height="30" rx="4" />,
  antebracos: <rect x="28.5" y="93" width="8" height="28" rx="4" />,
  deltoides: <circle cx="36" cy="47" r="7.5" />,
  quadriceps: <rect x="45.5" y="137" width="11.5" height="38" rx="5.5" />,
  adutores: <rect x="53" y="140" width="3.5" height="22" rx="1.75" />,
};
const FRONT_CENTER: Partial<Record<MuscleKey, React.ReactNode>> = {
  core: <rect x="49" y="63" width="22" height="32" rx="9" />,
  obliquos: <rect x="40.5" y="66" width="6" height="26" rx="3" />,
  flexores: <rect x="49" y="99" width="22" height="9" rx="4.5" />,
};

const BACK_ZONES: Partial<Record<MuscleKey, React.ReactNode>> = {
  dorsais: <rect x="41.5" y="56" width="17" height="27" rx="8" />,
  posteriores: <rect x="45.5" y="137" width="11.5" height="38" rx="5.5" />,
  panturrilhas: <rect x="46.5" y="188" width="9" height="32" rx="4.5" />,
  triceps: <rect x="28.5" y="57" width="8" height="30" rx="4" />,
  antebracos: <rect x="28.5" y="93" width="8" height="28" rx="4" />,
  deltoides: <circle cx="36" cy="47" r="7.5" />,
};
const BACK_CENTER: Partial<Record<MuscleKey, React.ReactNode>> = {
  trapezio: <rect x="45" y="41" width="30" height="13" rx="6" />,
  lombar: <rect x="48" y="86" width="24" height="16" rx="7" />,
  gluteos: <rect x="42.5" y="112" width="35" height="21" rx="10" />,
};

function Figure({
  label,
  zones,
  center,
  active,
}: {
  label: string;
  zones: Partial<Record<MuscleKey, React.ReactNode>>;
  center: Partial<Record<MuscleKey, React.ReactNode>>;
  active: Set<MuscleKey>;
}) {
  const mirroredActive = (Object.keys(zones) as MuscleKey[]).filter((k) => active.has(k));
  const centerActive = (Object.keys(center) as MuscleKey[]).filter((k) => active.has(k));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 246" className="h-52 w-auto" role="img" aria-label={`Mapa muscular — ${label}`}>
        <BodyBase />
        <g fill={ACTIVE} opacity="0.95">
          <Mirror>
            {mirroredActive.map((k) => (
              <g key={k} className="zone-active">{zones[k]}</g>
            ))}
          </Mirror>
          {centerActive.map((k) => (
            <g key={k} className="zone-active">{center[k]}</g>
          ))}
        </g>
      </svg>
      <span className="text-[10px] font-semibold tracking-[0.28em] text-fog-mute">{label}</span>
    </div>
  );
}

export default function MuscleMap({ muscles }: { muscles: MuscleKey[] }) {
  const active = new Set(muscles);
  return (
    <div>
      <div className="flex items-center justify-center gap-8 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-5 stripes-sport">
        <Figure label="FRENTE" zones={FRONT_ZONES} center={FRONT_CENTER} active={active} />
        <Figure label="COSTAS" zones={BACK_ZONES} center={BACK_CENTER} active={active} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {muscles.map((m) => (
          <span
            key={m}
            className="rounded-md bg-volt-400/12 px-2 py-1 text-[11px] font-semibold text-volt-300 ring-1 ring-volt-400/25"
          >
            {MUSCLE_LABEL[m]}
          </span>
        ))}
      </div>
    </div>
  );
}
