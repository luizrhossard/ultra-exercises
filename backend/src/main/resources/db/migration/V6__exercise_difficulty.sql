-- ============================================================
-- FORJA · V6 — dificuldade do exercício [UE-49]
-- Classificação INICIANTE / INTERMEDIARIO / AVANCADO para permitir
-- a seleção adequada ao nível do atleta. O backfill espelha a
-- curadoria do catálogo (nomes são unique, logo determinístico).
-- ============================================================

alter table exercises add column difficulty varchar(16);

update exercises set difficulty = 'AVANCADO' where name in (
    'Levantamento Terra',
    'Cadeira Nórdica'
);

update exercises set difficulty = 'INTERMEDIARIO' where name in (
    'Agachamento Búlgaro',
    'Salto na Caixa',
    'Sprint em Ladeira',
    'Flexão Pliométrica',
    'Barra Fixa',
    'Remada Curvada',
    'Desenvolvimento Militar',
    'Puxada na Toalha'
);

update exercises set difficulty = 'INICIANTE' where difficulty is null;

alter table exercises alter column difficulty set not null;
alter table exercises add constraint ck_exercises_difficulty
    check (difficulty in ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO'));

create index idx_exercises_difficulty on exercises (difficulty);
