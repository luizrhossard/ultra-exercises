import { useEffect, useState } from "react";
import { api } from "../api";
import type { ApiSharedRoutine } from "../api";
import { Logo } from "../components/Logo";

/** [UE-29] Leitura pública de rotina compartilhada via QR/link (/compartilhada/:token). */
export default function SharedRoutine({ token }: { token: string }) {
  const [data, setData] = useState<ApiSharedRoutine | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api.sharedRoutine(token)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="noise relative min-h-dvh">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 py-8">
        <Logo full />
        {error ? (
          <p role="alert" className="mt-10 rounded-xl border border-[#ff5148]/30 bg-[#ff5148]/8 p-4 text-center text-[13px] text-fog-dim">
            Rotina compartilhada não encontrada ou link inválido.
          </p>
        ) : !data ? (
          <p className="mt-10 animate-pulse text-center font-display uppercase tracking-[0.2em] text-volt-400">
            Carregando…
          </p>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl uppercase leading-none text-fog">{data.name}</h1>
            <p className="mt-1 text-[12px] text-fog-mute">
              {data.sportName} · rotina compartilhada por um atleta Forja
            </p>
            <ol className="mt-5 space-y-2">
              {data.items.map((item, i) => (
                <li key={`${item.exerciseName}-${i}`} className="rounded-xl border border-ink-700 bg-ink-850 p-3">
                  <p className="text-[13px] font-bold text-fog">
                    {i + 1}. {item.exerciseName}
                  </p>
                  <p className="text-[11px] text-fog-mute">
                    {item.sets} × {item.reps} · descanso {item.restTime}s
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-center text-[10px] uppercase tracking-[0.14em] text-fog-mute">
              Somente leitura · gere sua rotina no app Forja
            </p>
          </>
        )}
      </div>
    </div>
  );
}
