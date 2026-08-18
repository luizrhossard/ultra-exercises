-- ============================================================
-- FORJA · Migration inicial (Supabase / PostgreSQL)
-- Equivalente ao prisma/schema.prisma + políticas RLS.
-- ============================================================

create type "SportLevel" as enum ('RECREATIONAL', 'AMATEUR', 'COMPETITIVE', 'PROFESSIONAL');
create type "ExerciseCategory" as enum ('FORCA', 'PLIOMETRIA', 'CORE', 'CONDICIONAMENTO', 'MOBILIDADE', 'ESPECIFICO');

-- ---------- users ----------
create table "users" (
  "id"         text primary key,          -- = auth.uid()::text
  "email"      text unique not null,
  "name"       text,
  "created_at" timestamptz not null default now()
);

-- ---------- sports ----------
create table "sports" (
  "id"          text primary key default gen_random_uuid()::text,
  "code"        text unique not null,
  "name"        text not null,
  "description" text,
  "icon_url"    text
);

-- ---------- user_sport (N:N usuário × esporte) ----------
create table "user_sport" (
  "user_id"  text not null references "users"("id") on delete cascade,
  "sport_id" text not null references "sports"("id") on delete cascade,
  "level"    "SportLevel" not null default 'RECREATIONAL',
  primary key ("user_id", "sport_id")
);

-- ---------- exercises ----------
create table "exercises" (
  "id"               text primary key default gen_random_uuid()::text,
  "name"             text unique not null,
  "description"      text,
  "category"         "ExerciseCategory" not null default 'FORCA',
  "muscle_groups"    text[] not null default '{}',
  "equipment_needed" text[],
  "video_url"        text,               -- HLS no Supabase Storage
  "image_url"        text
);

-- ---------- exercise_sport (N:N — o coração do app) ----------
create table "exercise_sport" (
  "exercise_id"     text not null references "exercises"("id") on delete cascade,
  "sport_id"        text not null references "sports"("id") on delete cascade,
  "relevance_score" int  not null default 3 check ("relevance_score" between 1 and 5),
  "rationale"       text,                -- "por que ajuda neste esporte"
  primary key ("exercise_id", "sport_id")
);

-- Hot path do feed: exercícios de um esporte por relevância
create index "exercise_sport_sport_score_idx"
  on "exercise_sport" ("sport_id", "relevance_score" desc);

-- ---------- routines ----------
create table "routines" (
  "id"         text primary key default gen_random_uuid()::text,
  "user_id"    text not null references "users"("id") on delete cascade,
  "sport_id"   text not null references "sports"("id"),
  "name"       text not null,
  "created_at" timestamptz not null default now()
);
create index "routines_user_created_idx" on "routines" ("user_id", "created_at" desc);

-- ---------- routine_items ----------
create table "routine_items" (
  "routine_id"  text not null references "routines"("id") on delete cascade,
  "exercise_id" text not null references "exercises"("id") on delete cascade,
  "position"    int  not null default 0,
  "sets"        int  not null,
  "reps"        text not null,           -- "8 reps", "40 s", "AMRAP"…
  "rest_time"   int  not null default 60,
  primary key ("routine_id", "exercise_id")
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table "users"         enable row level security;
alter table "sports"        enable row level security;
alter table "user_sport"    enable row level security;
alter table "exercises"     enable row level security;
alter table "exercise_sport" enable row level security;
alter table "routines"      enable row level security;
alter table "routine_items" enable row level security;

-- Catálogo público para autenticados
create policy "sports_read"         on "sports"         for select to authenticated using (true);
create policy "exercises_read"      on "exercises"      for select to authenticated using (true);
create policy "exercise_sport_read" on "exercise_sport" for select to authenticated using (true);

-- Perfil: o usuário gerencia apenas o próprio registro (id = auth.uid())
create policy "users_insert_own" on "users" for insert to authenticated with check ("id" = auth.uid()::text);
create policy "users_select_own" on "users" for select to authenticated using ("id" = auth.uid()::text);
create policy "users_update_own" on "users" for update to authenticated using ("id" = auth.uid()::text);

-- Esportes do usuário: CRUD do dono
create policy "user_sport_all_own" on "user_sport" for all to authenticated
  using ("user_id" = auth.uid()::text)
  with check ("user_id" = auth.uid()::text);

-- Rotinas: CRUD do dono
create policy "routines_all_own" on "routines" for all to authenticated
  using ("user_id" = auth.uid()::text)
  with check ("user_id" = auth.uid()::text);

-- Itens: herdam a permissão da rotina pai
create policy "routine_items_all_own" on "routine_items" for all to authenticated
  using ("routine_id" in (select "id" from "routines" where "user_id" = auth.uid()::text))
  with check ("routine_id" in (select "id" from "routines" where "user_id" = auth.uid()::text));

-- ============================================================
-- View de conveniência: feed ordenado por esporte
-- ============================================================
create or replace view "v_exercise_feed" as
select
  es."sport_id",
  e."id"            as exercise_id,
  e."name",
  e."category",
  e."muscle_groups",
  e."equipment_needed",
  es."relevance_score",
  es."rationale",
  (select max(es2."relevance_score")
     from "exercise_sport" es2
    where es2."exercise_id" = e."id") as best_score
from "exercise_sport" es
join "exercises" e on e."id" = es."exercise_id";

grant select on "v_exercise_feed" to authenticated;
