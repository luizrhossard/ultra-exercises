-- ============================================================
-- FORJA · V3 — autenticação de dois fatores (TOTP) [UE-24]
-- ============================================================

alter table app_user
    add column totp_secret            varchar(255),
    add column totp_enabled           boolean     not null default false,
    add column totp_pending_secret    varchar(255),
    add column totp_pending_expires_at timestamptz;

-- Códigos de recuperação de uso único: apenas hash BCrypt é persistido.
create table recovery_code (
    id         bigserial primary key,
    user_id    bigint       not null references app_user (id) on delete cascade,
    code_hash  varchar(100) not null,
    used_at    timestamptz,
    created_at timestamptz  not null default now()
);

create index idx_recovery_code_user on recovery_code (user_id);
