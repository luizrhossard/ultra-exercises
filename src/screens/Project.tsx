import { motion } from "framer-motion";
import { ScoreMeter, SectionLabel } from "../components/ui";
import { IconCheck, IconChevron, IconCode, IconLayers } from "../components/Icons";
import { exerciseById } from "../data/exercises";
import { sportById } from "../data/sports";
import { SportIcon } from "../components/Icons";

const DELIVERED = [
  { file: "prisma/schema.prisma", desc: "9 modelos, 2 enums, N:N com rationale + índice do hot path" },
  { file: "supabase/migrations/…init_forja.sql", desc: "DDL completo, RLS por dono e view v_exercise_feed" },
  { file: "prisma/seed.ts", desc: "Upserts idempotentes — a base inteira versionada em código" },
  { file: ".env.example", desc: "Supabase + Prisma (conexão pooled e direta)" },
];

const SEED_PREVIEW: { ex: string; sport: string; score: number }[] = [
  { ex: "agachamento-bulgaro", sport: "futebol", score: 5 },
  { ex: "levantamento-terra", sport: "jiu-jitsu", score: 5 },
  { ex: "barra-fixa", sport: "natacao", score: 5 },
  { ex: "nordic-curl", sport: "corrida", score: 5 },
];

const REFINEMENTS = [
  {
    title: "selected_sports vira tabela UserSport",
    body: "Array no User limita o produto. Um join com nível (recreativo → profissional) permite dosar volume e intensidade das rotinas por perfil.",
  },
  {
    title: "Rationale no par exercise × sport",
    body: "O relevance_score (1–5) ordena o feed, mas o texto 'por que isso ajuda no meu esporte' é o que gera confiança e retenção — mora na própria tabela N:N.",
  },
  {
    title: "Índice no hot path do feed",
    body: "A query principal é 'exercises de um sport ordenados por relevance DESC'. Índice composto (sport_id, relevance_score DESC) evita sort em tabela cheia.",
  },
  {
    title: "Rotina com data e foco",
    body: "Routine ganha scheduledFor e focus (força / velocidade / recuperação) para virar um planner semanal, não só uma lista.",
  },
  {
    title: "Reps como String + lastRpe",
    body: "Rotina com reps fixas em Int quebra em '40 s', 'AMRAP', '8 cada lado'. Guardar o RPE da última sessão abre progressão automática.",
  },
  {
    title: "Vídeo em HLS no Storage",
    body: "video_url aponta para HLS no Supabase Storage com poster; no PWA, download offline dos exercícios favoritados.",
  },
];

const SCHEMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id             String      @id @default(uuid())
  email          String      @unique
  name           String?
  createdAt      DateTime    @default(now()) @map("created_at")
  selectedSports UserSport[]
  routines       Routine[]

  @@map("users")
}

enum SportLevel {
  RECREATIONAL
  AMATEUR
  COMPETITIVE
  PROFESSIONAL
}

model UserSport {
  userId  String     @map("user_id")
  sportId String     @map("sport_id")
  level   SportLevel @default(RECREATIONAL)
  user    User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  sport   Sport      @relation(fields: [sportId], references: [id], onDelete: Cascade)

  @@id([userId, sportId])
  @@map("user_sport")
}

model Sport {
  id          String          @id @default(uuid())
  code        String          @unique
  name        String
  description String?
  iconUrl     String?         @map("icon_url")
  exercises   ExerciseSport[]
  users       UserSport[]
  routines    Routine[]

  @@map("sports")
}

model Exercise {
  id            String          @id @default(uuid())
  name          String
  description   String?
  muscleGroups  String[]        @map("muscle_groups")
  equipment     String?         @map("equipment_needed")
  videoUrl      String?         @map("video_url")
  imageUrl      String?         @map("image_url")
  sports        ExerciseSport[]
  routineItems  RoutineItem[]

  @@index([name])
  @@map("exercises")
}

model ExerciseSport {
  exerciseId     String   @map("exercise_id")
  sportId        String   @map("sport_id")
  relevanceScore Int      @map("relevance_score")
  rationale      String?
  exercise       Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  sport          Sport    @relation(fields: [sportId], references: [id], onDelete: Cascade)

  @@id([exerciseId, sportId])
  @@index([sportId, relevanceScore(sort: Desc)])
  @@map("exercise_sport")
}

model Routine {
  id        String        @id @default(uuid())
  userId    String        @map("user_id")
  sportId   String        @map("sport_id")
  name      String
  createdAt DateTime      @default(now()) @map("created_at")
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  sport     Sport         @relation(fields: [sportId], references: [id])
  items     RoutineItem[]

  @@index([userId, createdAt(sort: Desc)])
  @@map("routines")
}

model RoutineItem {
  routineId  String   @map("routine_id")
  exerciseId String   @map("exercise_id")
  position   Int      @default(0)
  sets       Int
  reps       String
  restTime   Int      @map("rest_time")
  routine    Routine  @relation(fields: [routineId], references: [id], onDelete: Cascade)
  exercise   Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@id([routineId, exerciseId])
  @@map("routine_items")
}`;

const TREE = `app/
├─ layout.tsx                  # fontes, tema, providers
├─ (auth)/
│  ├─ login/page.tsx
│  └─ signup/page.tsx
├─ (app)/
│  ├─ layout.tsx               # BottomNav + guard de sessão
│  ├─ onboarding/page.tsx      # seleção de esportes
│  ├─ explorar/page.tsx        # feed ranqueado
│  ├─ exercicio/[id]/page.tsx  # player
│  ├─ rotinas/
│  │  ├─ page.tsx              # lista + gerador
│  │  └─ [id]/page.tsx         # edição da rotina
│  └─ perfil/page.tsx
└─ api/webhooks/supabase/route.ts

components/
├─ ui/                         # shadcn: button, sheet, dialog…
├─ exercise-card.tsx
├─ relevance-meter.tsx
├─ muscle-map.tsx
└─ bottom-nav.tsx

lib/
├─ supabase/  server.ts · client.ts · middleware.ts
├─ db.ts                       # Prisma client singleton
└─ queries/   exercises.ts · routines.ts

prisma/
├─ schema.prisma
└─ seed.ts                     # 8 esportes + exercícios + scores`;

const PHASES: { n: number; title: string; body: string; status: "shipped" | "done" | "next" }[] = [
  {
    n: 1,
    title: "Setup & DB",
    body: "Next.js 14 + TS + Tailwind + shadcn; projeto Supabase; Prisma schema com 9 modelos + migration SQL com RLS + seed idempotente (8 esportes · 22 exercícios · 92 pares N:N).",
    status: "shipped",
  },
  {
    n: 2,
    title: "Auth & Onboarding",
    body: "Supabase Auth (email + Google); seleção de esportes persistida em user_sport; RLS por usuário.",
    status: "done",
  },
  {
    n: 3,
    title: "Feed & Player",
    body: "Feed filtrado e ordenado por relevance_score; player com vídeo, passo a passo, músculos e rationale por esporte.",
    status: "done",
  },
  {
    n: 4,
    title: "Rotinas & Gerador",
    body: "CRUD de rotinas com Prisma; gerador por demandas; modo execução com timer de descanso e registro de RPE.",
    status: "next",
  },
  {
    n: 5,
    title: "PWA & Polish",
    body: "Instalável, vídeos offline via Storage/CDN, animações Framer Motion auditadas, testes de carga no feed e lançamento.",
    status: "next",
  },
];

export default function Project() {
  return (
    <div className="px-5 pb-32 pt-6">
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-[40px] uppercase leading-none text-fog"
      >
        Projeto
      </motion.h1>
      <p className="mt-2 text-[13px] text-fog-dim">
        O blueprint técnico do produto — esquema de dados, arquitetura e plano de fases.
      </p>

      <div className="mt-4 rounded-xl border border-volt-400/30 bg-volt-400/8 p-3.5 text-[12px] leading-relaxed text-fog-dim">
        <strong className="text-volt-300">Plano aprovado — Fase 1 entregue no repositório.</strong>{" "}
        Este app é o protótipo navegável das fases 1–3 (banco simulado no navegador com a mesma
        modelagem N:N); abaixo, o blueprint e os artefatos do projeto real Next.js + Supabase + Prisma.
      </div>

      {/* entrega fase 1 */}
      <section className="mt-7">
        <div className="flex items-center justify-between">
          <SectionLabel>00 · Entrega da Fase 1</SectionLabel>
          <span className="flex items-center gap-1.5 rounded-md bg-[#5b8cff]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7fa4ff]">
            <span className="blink-dot h-1.5 w-1.5 rounded-full bg-[#7fa4ff]" /> no repo
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
          {DELIVERED.map((d, i) => (
            <div
              key={d.file}
              className={`flex items-center gap-3 px-3.5 py-3 ${i > 0 ? "border-t border-ink-700/70" : ""}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#5b8cff]/12 text-[#7fa4ff]">
                <IconCode size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] font-bold text-fog">{d.file}</p>
                <p className="truncate text-[11px] text-fog-mute">{d.desc}</p>
              </div>
              <span className="text-[#7fa4ff]"><IconCheck size={14} strokeWidth={2.6} /></span>
            </div>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {[
            { v: "8", l: "esportes" },
            { v: "22", l: "exercícios" },
            { v: "92", l: "pares N:N" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-ink-700 bg-ink-850 py-2.5 text-center">
              <p className="tabular font-display text-xl leading-none text-[#7fa4ff]">{s.v}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-fog-mute">{s.l}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-fog-mute">
          Amostra do seed — tabela exercise_sport
        </p>
        <div className="mt-2 space-y-1.5">
          {SEED_PREVIEW.map((row) => {
            const ex = exerciseById(row.ex);
            const sport = sportById(row.sport);
            const link = ex?.links.find((l) => l.sport === row.sport);
            if (!ex) return null;
            return (
              <div
                key={`${row.ex}-${row.sport}`}
                className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: `${sport.color}18`, color: sport.color }}>
                  <SportIcon id={sport.id} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-fog">
                    {ex.name} <span className="text-fog-mute">×</span> {sport.name}
                  </p>
                  <p className="truncate text-[10.5px] italic text-fog-mute">“{link?.why}”</p>
                </div>
                <ScoreMeter score={row.score} color={sport.color} size="sm" />
              </div>
            );
          })}
        </div>
      </section>

      {/* refinements */}
      <section className="mt-7">
        <SectionLabel>01 · Refinamentos propostos ao escopo</SectionLabel>
        <div className="mt-3 space-y-2">
          {REFINEMENTS.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3.5"
            >
              <span className="font-display text-lg leading-none text-volt-400">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-[13px] font-bold text-fog">{r.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-fog-dim">{r.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* schema */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <span className="text-volt-400"><IconCode size={15} /></span>
          <SectionLabel>02 · schema.prisma (relação N:N)</SectionLabel>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-700">
          <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-800 px-3.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5148]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffd23d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d97b]" />
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fog-mute">
              prisma/schema.prisma
            </span>
          </div>
          <pre className="max-h-[380px] overflow-auto bg-ink-950 p-4 text-[10.5px] leading-[1.55] text-[#9fd8a8]">
            {SCHEMA}
          </pre>
        </div>
      </section>

      {/* tree */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <span className="text-volt-400"><IconLayers size={15} /></span>
          <SectionLabel>03 · Árvore Next.js App Router</SectionLabel>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-ink-700 bg-ink-950 p-4 text-[10.5px] leading-[1.6] text-fog-dim">
          {TREE}
        </pre>
      </section>

      {/* phases */}
      <section className="mt-8">
        <SectionLabel>04 · Plano de ação em 5 fases</SectionLabel>
        <div className="mt-3 space-y-0">
          {PHASES.map((p, i) => (
            <motion.div
              key={p.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06 }}
              className="relative flex gap-4 pb-5"
            >
              {i < PHASES.length - 1 && (
                <span className="absolute left-[15px] top-9 h-[calc(100%-30px)] w-px bg-ink-700" />
              )}
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-sm ${
                  p.status === "shipped"
                    ? "border-[#5b8cff]/60 bg-[#5b8cff]/12 text-[#7fa4ff]"
                    : p.status === "done"
                      ? "border-volt-400/50 bg-volt-400/12 text-volt-400"
                      : "border-ink-600 bg-ink-850 text-fog-mute"
                }`}
              >
                {p.n}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-[15px] uppercase tracking-wide text-fog">
                    Fase {p.n} — {p.title}
                  </p>
                  <span
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                      p.status === "shipped"
                        ? "bg-[#5b8cff]/15 text-[#7fa4ff]"
                        : p.status === "done"
                          ? "bg-volt-400/12 text-volt-300"
                          : "bg-ink-800 text-fog-mute"
                    }`}
                  >
                    {p.status === "next" ? (
                      <IconChevron size={9} strokeWidth={3} />
                    ) : (
                      <IconCheck size={9} strokeWidth={3} />
                    )}
                    {p.status === "shipped" ? "Entregue no repo" : p.status === "done" ? "Prototipada aqui" : "Próxima"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-fog-dim">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
