import { useEffect, useState } from "react";
import { api, type AthleteProfile } from "../api";
import { useApp } from "../store";
import { CACHE_TTL, setCache, userCacheKey } from "../cache";

const LEVELS = [
  ["RECREATIONAL", "Recreativo / iniciante"],
  ["AMATEUR", "Amador"],
  ["COMPETITIVE", "Competitivo"],
  ["PROFESSIONAL", "Profissional"],
] as const;

export default function TrainingLevelSettings() {
  const { token, toast } = useApp();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    api.me(token).then((remote) => {
      if (!active) return;
      setProfile(remote);
      setLevels(Object.fromEntries(remote.sports.map((s) => [s.code, s.level])));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token]);

  const save = async () => {
    if (!token || !profile) return;
    setSaving(true);
    try {
      const remote = await api.saveProfile(token, profile.name ?? "", profile.sports.map((s) => s.code), undefined, levels);
      setProfile(remote);
      setCache(userCacheKey(token), "me", remote, CACHE_TTL.profile);
      toast("Níveis salvos. O próximo treino usará essas informações.");
    } catch { toast("Não foi possível salvar os níveis."); }
    finally { setSaving(false); }
  };

  return <section className="mt-4 rounded-2xl border border-ink-700 bg-ink-850 p-4">
    <h2 className="font-display text-xl uppercase text-fog">Seu nível por esporte</h2>
    <p className="mt-2 text-[12px] text-fog-dim">Informe sua experiência real para ajustar o volume dos próximos treinos.</p>
    {failed ? <p role="alert" className="mt-3 text-sm text-fog-dim">Não foi possível carregar seus níveis. Recarregue a página.</p>
      : !profile ? <p className="mt-3 text-sm text-fog-mute">Carregando níveis…</p>
      : profile.sports.map((sport) => <label key={sport.code} className="mt-3 block text-[12px] text-fog">
        {sport.name}
        <select value={levels[sport.code] ?? "RECREATIONAL"} onChange={(e) => setLevels((current) => ({ ...current, [sport.code]: e.target.value }))} className="mt-1 block w-full rounded-lg bg-ink-800 p-2 text-fog">
          {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>)}
    <button onClick={() => void save()} disabled={!profile?.sports.length || saving} className="mt-4 rounded-lg border border-volt-400/50 px-4 py-2 text-[12px] font-bold text-volt-300 disabled:opacity-50">{saving ? "Salvando…" : "Salvar níveis"}</button>
  </section>;
}
