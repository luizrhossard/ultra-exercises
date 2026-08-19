-- Dados de acompanhamento individual. Rotinas continuam sendo prescrições;
-- sessões armazenam o que o atleta realmente executou.
create table readiness_checkins (
    id              bigserial primary key,
    user_id         bigint not null references app_user (id) on delete cascade,
    checkin_date    date not null,
    sleep_quality   int not null check (sleep_quality between 1 and 5),
    fatigue         int not null check (fatigue between 1 and 5),
    stress          int not null check (stress between 1 and 5),
    soreness        int not null check (soreness between 1 and 5),
    pain_area       varchar(80),
    pain_level      int not null default 0 check (pain_level between 0 and 10),
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (user_id, checkin_date)
);

create table training_sessions (
    id              bigserial primary key,
    user_id         bigint not null references app_user (id) on delete cascade,
    routine_id      bigint references routines (id) on delete set null,
    sport_id        bigint not null references sports (id),
    status          varchar(20) not null default 'PLANNED'
        check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    scheduled_at    timestamptz not null default now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    duration_minutes int check (duration_minutes between 1 and 600),
    session_rpe     int check (session_rpe between 1 and 10),
    notes           text
);

create index idx_training_sessions_user_date
    on training_sessions (user_id, scheduled_at desc);

create table training_session_items (
    session_id          bigint not null references training_sessions (id) on delete cascade,
    exercise_id         bigint not null references exercises (id),
    position            int not null,
    prescribed_sets     int not null check (prescribed_sets between 1 and 10),
    prescribed_reps     varchar(40) not null,
    prescribed_rest_time int not null check (prescribed_rest_time between 0 and 900),
    completed_sets      int check (completed_sets between 0 and 10),
    completed_reps      varchar(40),
    load_kg             numeric(6,2) check (load_kg >= 0),
    item_rpe            int check (item_rpe between 1 and 10),
    pain_level          int check (pain_level between 0 and 10),
    notes               text,
    primary key (session_id, exercise_id)
);
