-- [UE-29] Token de compartilhamento público de rotina (gerado sob demanda).
alter table routines add column share_token varchar(32);
create unique index idx_routines_share_token on routines (share_token) where share_token is not null;
