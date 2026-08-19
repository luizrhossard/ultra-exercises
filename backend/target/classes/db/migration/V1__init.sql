-- ============================================================
-- FORJA · V1 — esquema inicial (Spring Boot + Flyway + PostgreSQL)
-- A segurança de dados por usuário fica na camada Spring Security
-- (JWT + filtros), não em RLS.
-- ============================================================

create table sports (
    id          bigserial primary key,
    code        varchar(40)  not null unique,
    name        varchar(80)  not null,
    description text,
    icon_url    varchar(255)
);

create table exercises (
    id          bigserial primary key,
    name        varchar(120) not null unique,
    description text,
    category    varchar(24)  not null
        check (category in ('FORCA','PLIOMETRIA','CORE','CONDICIONAMENTO','MOBILIDADE','ESPECIFICO')),
    equipment   varchar(120),
    video_url   varchar(255),
    image_url   varchar(255)
);

create table exercise_muscles (
    exercise_id bigint      not null references exercises (id) on delete cascade,
    muscle      varchar(40) not null,
    primary key (exercise_id, muscle)
);

create table exercise_steps (
    exercise_id bigint not null references exercises (id) on delete cascade,
    position    int    not null,
    step        text   not null,
    primary key (exercise_id, position)
);

-- Relação N:N reificada: o coração do produto.
create table exercise_sport (
    exercise_id     bigint not null references exercises (id) on delete cascade,
    sport_id        bigint not null references sports (id) on delete cascade,
    relevance_score int    not null default 3
        check (relevance_score between 1 and 5),
    rationale       text,               -- "por que ajuda neste esporte"
    primary key (exercise_id, sport_id)
);

-- Hot path do feed: exercícios de um esporte ordenados por relevância.
create index idx_exercise_sport_feed on exercise_sport (sport_id, relevance_score desc);

create table app_user (
    id         bigserial primary key,
    email      varchar(160) not null unique,
    password   varchar(100) not null,   -- BCrypt
    name       varchar(80),
    created_at timestamptz  not null default now()
);

-- N:N usuário × esporte (com nível de prática para dosar volume/intensidade).
create table user_sport (
    user_id  bigint      not null references app_user (id) on delete cascade,
    sport_id bigint      not null references sports (id) on delete cascade,
    level    varchar(20) not null default 'RECREATIONAL'
        check (level in ('RECREATIONAL','AMATEUR','COMPETITIVE','PROFESSIONAL')),
    primary key (user_id, sport_id)
);

create table routines (
    id         bigserial primary key,
    user_id    bigint       not null references app_user (id) on delete cascade,
    sport_id   bigint       not null references sports (id),
    name       varchar(120) not null,
    created_at timestamptz  not null default now()
);

create index idx_routines_user on routines (user_id, created_at desc);

create table routine_items (
    routine_id  bigint      not null references routines (id) on delete cascade,
    exercise_id bigint      not null references exercises (id) on delete cascade,
    position    int         not null default 0,
    sets        int         not null check (sets between 1 and 10),
    reps        varchar(24) not null,   -- "8 reps", "40 s", "AMRAP", "8 cada lado"…
    rest_time   int         not null default 60,
    primary key (routine_id, exercise_id)
);
