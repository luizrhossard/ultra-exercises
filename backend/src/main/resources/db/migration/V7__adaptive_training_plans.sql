-- Uma prescrição planejada por atleta e data; sessions mantêm o registro da execução.
alter table routines add column plan_date date;
alter table routines add column readiness_score int check (readiness_score between 0 and 30);
alter table routines add column readiness_adjusted boolean not null default false;
alter table routines add column requires_review boolean not null default false;
alter table routines add column explanation text;
alter table routines add column rest_day boolean not null default false;
alter table app_user add column training_goal varchar(80);
alter table app_user add column training_days varchar(80);
alter table app_user add column session_duration_minutes int check (session_duration_minutes between 15 and 240);
alter table app_user add column available_equipment text;
alter table app_user add column training_preferences text;
alter table app_user add column training_limitations text;
create unique index uq_routines_user_plan_date
    on routines (user_id, plan_date)
    where plan_date is not null;

alter table training_sessions add column plan_date date;
alter table training_sessions drop constraint training_sessions_status_check;
alter table training_sessions add constraint training_sessions_status_check
    check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'INTERRUPTED', 'SKIPPED'));
create unique index uq_training_sessions_user_plan_date
    on training_sessions (user_id, plan_date)
    where plan_date is not null;
