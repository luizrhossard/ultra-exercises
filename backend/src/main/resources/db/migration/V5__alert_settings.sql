-- [UE-28] Preferências de alertas inteligentes de descanso (uma linha por atleta).
create table alert_settings (
    user_id                bigint primary key references app_user (id) on delete cascade,
    enabled                boolean not null default true,
    max_sessions_per_week  int not null default 5 check (max_sessions_per_week between 1 and 14),
    min_rest_hours         int not null default 48 check (min_rest_hours between 0 and 96)
);
