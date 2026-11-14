# Dificuldade do exercício e relação com o SportLevel [UE-49 / UE-50 / UE-51 / UE-52]

Visão geral de como a classificação de dificuldade, o nível do atleta e a geração
de rotina se conectam. Detalhes do gerador: `routine-generator-sport-level.md`.
Catálogos por esporte: `catalogo-natacao.md` e `catalogo-volei.md`.

## Dificuldade do exercício (`ExerciseDifficulty`)

Valores: `INICIANTE`, `INTERMEDIARIO`, `AVANCADO`.

- Campo obrigatório em `exercises` (migration `V6__exercise_difficulty.sql`, constraint
  `ck_exercises_difficulty`, índice `idx_exercises_difficulty`).
- O seed (`seed/data.json`) define a dificuldade de cada exercício. `null` no seed é
  tratado como `INICIANTE` pelo gerador.
- API: `GET /api/exercises?difficulty=...` filtra o catálogo; valor inválido retorna
  400 no formato de erro padrão. O campo `difficulty` aparece em lista, detalhe e feed.
- Frontend: `src/data/feed.ts` (`difficultyToLevel`) converte a dificuldade oficial da API
  no nível exibido no card do feed (INICIANTE=1, INTERMEDIARIO=2, AVANCADO=3), com fallback
  para o catálogo local quando a API está indisponível (UE-49). É só um mapeamento de
  exibição; a regra de seleção fica no backend.

## Relação entre SportLevel e a geração da rotina

```
User → UserSport(sport, level) → esporte FOCO → SportLevel
     → bônus/bloqueio por dificuldade → cotas por categoria → dosagem
```

- O nível usado é o do esporte foco; sem vínculo, assume-se `RECREATIONAL`.
- Regras completas (tabelas de bônus, cotas, séries/reps/descanso) estão em
  `routine-generator-sport-level.md`, implementadas em `SportLevelPolicy`.

## Regras resumidas

| Nível | Bloqueio | Prioridade de dificuldade | Tamanho da rotina |
|---|---|---|---|
| RECREATIONAL | AVANCADO | INICIANTE, depois INTERMEDIARIO | 7 |
| AMATEUR | AVANCADO | INICIANTE e INTERMEDIARIO | 7 |
| COMPETITIVE | — | INTERMEDIARIO, depois AVANCADO | 8 |
| PROFESSIONAL | — | AVANCADO, depois INTERMEDIARIO | 8 |

A relevância por esporte (2 × foco + melhor nos demais) continua sendo o critério dominante.
O bônus de dificuldade vale no máximo 1 ponto de relevância no foco.

## Testes que demonstram as regras

- `RoutineGeneratorServiceTest`: seleção e dosagem por nível, bloqueio de AVANCADO nos
  níveis de base, relevância dominante.
- `ExerciseDifficultyIntegrationTest`: classificação de todo o seed, filtros da API e contagens
  por dificuldade.
- `NatacaoCatalogIntegrationTest` e `VoleiCatalogIntegrationTest`: catálogos por esporte e
  funcionamento do gerador com os exercícios novos.
