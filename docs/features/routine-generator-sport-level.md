# Gerador de rotinas sensível ao SportLevel [UE-50]

Epic: UE-48 — Catálogo de exercícios específico por esporte e sensível ao nível do atleta.

Código: `backend/src/main/java/com/forja/service/SportLevelPolicy.java` (regras) e
`RoutineGeneratorService.java` (pipeline). Testes: `RoutineGeneratorServiceTest`.

## Relação entre SportLevel e a rotina

```
User → UserSport (sport, level) → esporte FOCO → SportLevel
     → filtro/bônus de dificuldade → cotas por categoria → dosagem
```

- Cada `UserSport` tem seu próprio `level`; o mesmo usuário pode ser `PROFESSIONAL`
  no futebol e `RECREATIONAL` na corrida.
- **Vale o nível do esporte foco** da geração (`POST /api/routines/generate {sportId}`).
- Se o usuário não pratica o esporte foco, assume-se `RECREATIONAL` (progressão segura).
- Níveis usados: os quatro do enum — `RECREATIONAL`, `AMATEUR`, `COMPETITIVE`, `PROFESSIONAL`.
  Nenhum nível novo foi criado.

## Regras de seleção

1. **Relevância (inalterada):** `relevância = 2 × score no foco + melhor score nos demais esportes do usuário`.
   Exercícios com relevância 0 são descartados.
2. **Filtro de dificuldade:** dificuldades bloqueadas para o nível saem do ranking (ver tabela).
3. **Bônus de dificuldade:** `total = relevância + bônus(nível, dificuldade)`.
   O bônus vai de −1 a +2, ou seja, vale no máximo **1 ponto de relevância no foco**. Assim a
   relevância por esporte continua sendo o critério dominante e o bônus só desempata/ajusta.
4. **Ordenação determinística:** `total` desc → score no foco desc → id do exercício asc.
5. **Cotas por categoria** (preenchidas na ordem FORCA, PLIOMETRIA, CORE, CONDICIONAMENTO,
   ESPECIFICO, MOBILIDADE) e depois **preenchimento por ranking** até o tamanho máximo.

### Regras de dificuldade (bônus; ✗ = bloqueado)

| Nível         | INICIANTE | INTERMEDIARIO | AVANCADO |
|---------------|:---------:|:-------------:|:--------:|
| RECREATIONAL  | +2        | 0             | ✗        |
| AMATEUR       | +1        | +1            | ✗        |
| COMPETITIVE   | 0         | +2            | +1       |
| PROFESSIONAL  | −1        | +1            | +2       |

- RECREATIONAL prioriza INICIANTE, aceita INTERMEDIARIO e nunca recebe AVANCADO — nem com
  relevância 5. Se só houver AVANCADO, a rotina sai vazia em vez de insegura.
- AMATEUR equilibra INICIANTE/INTERMEDIARIO, ainda sem AVANCADO.
- COMPETITIVE desbloqueia AVANCADO com foco em INTERMEDIARIO.
- PROFESSIONAL prioriza AVANCADO e desprioriza INICIANTE.
- Dificuldade ausente (`null`) é tratada como INICIANTE.

### Cotas e tamanho

| Nível        | FORCA | PLIO | CORE | COND | ESPECIFICO | MOB | Máx. itens |
|--------------|:-----:|:----:|:----:|:----:|:----------:|:---:|:----------:|
| RECREATIONAL | 2     | 1    | 1    | 1    | 1          | 1   | 7          |
| AMATEUR      | 2     | 1    | 1    | 1    | 1          | 1   | 7          |
| COMPETITIVE  | 2     | 2    | 1    | 1    | 1          | 1   | 8          |
| PROFESSIONAL | 2     | 1    | 1    | 1    | 2          | 1   | 8          |

A base 2/1/1/1/1/1 continua valendo. O COMPETITIVE ganha mais potência (pliometria) e o
PROFESSIONAL mais trabalho específico do esporte.

## Regras de dosagem

Formato: `séries × reps/duração · descanso (s)`.

| Categoria       | RECREATIONAL     | AMATEUR (padrão) | COMPETITIVE      | PROFESSIONAL     |
|-----------------|------------------|------------------|------------------|------------------|
| FORCA           | 3 × 10 reps · 120 | 4 × 8 reps · 120 | 4 × 6 reps · 150 | 5 × 5 reps · 180 |
| PLIOMETRIA      | 3 × 5 reps · 120 | 4 × 6 reps · 90  | 5 × 6 reps · 90  | 5 × 8 reps · 90  |
| CORE            | 2 × 30 s · 60    | 3 × 40 s · 45    | 3 × 50 s · 45    | 4 × 60 s · 40    |
| CONDICIONAMENTO | 3 × 20 s · 90    | 5 × 30 s · 60    | 6 × 30 s · 45    | 6 × 40 s · 40    |
| MOBILIDADE      | 2 × 45 s · 30    | 2 × 45 s · 30    | 2 × 60 s · 30    | 3 × 60 s · 30    |
| ESPECIFICO      | 2 × 2 min · 120  | 3 × 3 min · 90   | 4 × 3 min · 75   | 5 × 4 min · 60   |

- **Bônus de foco:** +1 série quando o exercício tem relevância 5 no esporte foco — exceto
  RECREATIONAL (progressão segura). Teto de 6 séries por exercício.
- Força: mais nível = menos reps, mais carga e mais descanso (intensidade). Condicionamento,
  core e específico: mais nível = mais volume/duração e menos descanso (densidade).
- A tabela AMATEUR é o padrão (`RoutineGeneratorService.PRESETS`), usado quando não há
  contexto de nível, p.ex. ao adicionar exercício manualmente (`POST /api/routines/{id}/items`).

## Garantias cobertas por teste

| Requisito | Teste |
|---|---|
| Níveis diferentes por esporte no mesmo usuário | `sameUserUsesLevelOfFocusSport` |
| Rotina muda com o nível / recreativo ≠ profissional | `routineChangesWithSportLevel` |
| AVANCADO bloqueado nos níveis de base | `entryLevelsNeverReceiveAdvancedExercises`, `recreationalWithOnlyAdvancedCatalogGetsEmptyRoutineInsteadOfUnsafeOne` |
| Profissional recebe AVANCADO e mais ESPECIFICO | `highLevelsReceiveAdvancedAndSpecificExercises` |
| Volume/intensidade por nível (18 → 25 → 36 → 41 séries no catálogo de referência) | `volumeAndIntensityScaleWithLevel`, `recreationalDoesNotGetFocusExtraSet` |
| Relevância e peso do foco preservados | `relevanceStillDominatesDifficultyBonus`, `focusSportScoreCountsDouble`, `respectsCategoryQuotas` |
