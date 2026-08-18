import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EXERCISES, bestLink, rankFor } from "../data/exercises";
import { SPORTS, sportById } from "../data/sports";
import { MUSCLE_LABEL, CATEGORY_ACCENT } from "../types";
import type { Category } from "../types";
import { useApp } from "../store";
import { SportIcon, IconSearch, IconChevron, IconDumbbell, IconBolt } from "../components/Icons";
import { ScoreMeter, SectionLabel } from "../components/ui";

const CATS: (Category | "Todas")[] = ["Todas", "Força", "Pliometria", "Core", "Condicionamento", "Mobilidade", "Específico"];
const LEVEL = ["", "Iniciante", "Intermediário", "Avançado"];

export default function Feed() {
  const { profile, openPlayer, setTab } = useApp();
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [cat, setCat] = useState<Category | "Todas">("Todas");

  const mySports = profile.sports;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((ex) => rankFor(ex, mySports) > 0)
      .filter((ex) => sportFilter === "all" || ex.links.some((l) => l.sport === sportFilter))
      .filter((ex) => cat === "Todas" || ex.category === cat)
      .filter(
        (ex) =>
          !q ||
          ex.name.toLowerCase().includes(q) ||
          ex.equipment.toLowerCase().includes(q) ||
          ex.muscles.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q))
      )
      .sort((a, b) => rankFor(b, mySports) - rankFor(a, mySports) || a.name.localeCompare(b.name));
  }, [mySports, query, sportFilter, cat]);

  return (
    <div className="px-5 pb-32 pt-6 lg:px-10 lg:pb-24 lg:pt-10">
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="font-display text-sm uppercase tracking-[0.2em] text-fog-mute">Forja</span>
        <button
          onClick={() => setTab("perfil")}
          className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 bg-ink-800 font-display text-sm text-volt-400 transition-colors hover:border-volt-400"
          aria-label="Abrir perfil"
        >
          {(profile.name || "A")[0].toUpperCase()}
        </button>
      </div>

      <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 font-display text-[40px] uppercase leading-none text-fog lg:text-[56px]"
          >
            Explorar
          </motion.h1>
          <p className="mt-2 max-w-md text-[13px] text-fog-dim">
            <span className="tabular font-bold text-volt-400">{list.length}</span> exercícios ordenados por
            relevância para {mySports.map((s) => sportById(s).name).join(", ")}.
          </p>
        </div>

        {/* search */}
        <div className="relative mt-5 lg:mt-0 lg:w-[380px] lg:shrink-0 lg:pb-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fog-mute">
            <IconSearch size={17} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar exercício, músculo, equipamento…"
            className="w-full rounded-xl border border-ink-700 bg-ink-850 py-3 pl-10 pr-4 text-[14px] text-fog placeholder:text-fog-mute focus:border-volt-400 focus:outline-none"
          />
        </div>
      </div>

      {/* sport chips */}
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        <Chip active={sportFilter === "all"} onClick={() => setSportFilter("all")} label="Todos" />
        {mySports.map((id) => {
          const s = sportById(id);
          return (
            <Chip
              key={id}
              active={sportFilter === id}
              onClick={() => setSportFilter(sportFilter === id ? "all" : id)}
              label={s.name}
              color={s.color}
              icon={<SportIcon id={id} size={14} />}
            />
          );
        })}
      </div>

      {/* category chips */}
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
              cat === c ? "bg-ink-600 text-fog" : "bg-ink-800 text-fog-mute hover:text-fog-dim"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="mt-5 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {list.map((ex, i) => {
          const link = bestLink(ex, mySports);
          const sport = link ? sportById(link.sport) : null;
          const extra = ex.links
            .filter((l) => mySports.includes(l.sport) && l.sport !== link?.sport && l.score >= 4)
            .slice(0, 2);
          return (
            <motion.button
              key={ex.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.045, 0.4), duration: 0.35, ease: "easeOut" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openPlayer(ex.id)}
              className="block w-full rounded-2xl border border-ink-700 bg-ink-850 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-500 hover:bg-ink-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                      style={{ background: `${CATEGORY_ACCENT[ex.category]}1c`, color: CATEGORY_ACCENT[ex.category] }}
                    >
                      {ex.category}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-fog-mute">
                      <IconBolt size={11} strokeWidth={2.2} />
                      {LEVEL[ex.level]}
                    </span>
                  </div>
                  <h3 className="mt-1.5 truncate font-display text-[19px] uppercase tracking-wide text-fog">
                    {ex.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-fog-mute">
                    {ex.muscles.slice(0, 3).map((m) => MUSCLE_LABEL[m]).join(" · ")} — {ex.equipment}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {link && sport && (
                    <>
                      <ScoreMeter score={link.score} color={sport.color} />
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: sport.color }}>
                        <SportIcon id={sport.id} size={12} />
                        {sport.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-700/70 pt-2.5">
                <span className="flex items-center gap-2">
                  {extra.map((l) => (
                    <span
                      key={l.sport}
                      className="flex items-center gap-1 rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ color: sportById(l.sport).color }}
                    >
                      <SportIcon id={l.sport} size={11} /> {l.score}/5
                    </span>
                  ))}
                  {extra.length === 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-fog-mute">
                      <IconDumbbell size={13} /> {ex.tempo}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-fog-mute">
                  Abrir <IconChevron size={13} />
                </span>
              </div>
            </motion.button>
          );
        })}

        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-600 p-8 text-center">
            <p className="font-display text-lg uppercase text-fog-dim">Nada por aqui</p>
            <p className="mt-1 text-[12px] text-fog-mute">Tente outra busca ou limpe os filtros.</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-fog-mute">
        {SPORTS.length} esportes mapeados · relação N:N exercise × sport
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-all"
      style={{
        borderColor: active ? (color ?? "#d4f53c") : "#1f2a32",
        background: active ? `${color ?? "#d4f53c"}16` : "#10161b",
        color: active ? (color ?? "#d4f53c") : "#9aa9a2",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
