# Forja API — Referência OpenAPI

Spec interativa gerada pelo **springdoc-openapi**: `http://localhost:8085/swagger-ui/index.html`
(JSON: `http://localhost:8085/v3/api-docs`). Este documento é o resumo navegável do contrato.

## Autenticação

`Authorization: Bearer <token>` em todos os endpoints protegidos. Token JWT HS256
obtido em `POST /api/auth/register` ou `POST /api/auth/login`.

## Contrato de erro (todos os endpoints)

```json
{
  "timestamp": "2026-08-20T20:17:12.311631800Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "fields": [{ "field": "password", "message": "tamanho deve ser entre 8 e 2147483647" }],
  "traceId": "d9623d7f-..."
}
```

| Status | `error` | Quando |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bean Validation falhou (`fields[]` detalha) |
| 400 | `BAD_REQUEST` | Requisição malformada (ex.: corpo inválido) |
| 401 | `UNAUTHORIZED` | Token ausente/inválido/expirado, ou credenciais incorretas |
| 403 | `FORBIDDEN` | Autenticado sem permissão |
| 404 | `NOT_FOUND` | Recurso inexistente ou **não pertence ao usuário** (IDOR) |
| 500 | `INTERNAL_ERROR` | Erro inesperado (com `traceId` para rastreio) |

## Endpoints

### Auth — `POST /api/auth/register`, `POST /api/auth/login`
`{email, password, name}` → `{token, email, name, sports[]}` (201 register, 200 login).
Login com credenciais inválidas → 401 `UNAUTHORIZED`.

### Sports — `GET /api/sports` (público)
`[{id, code, name, description}]` — códigos: `futebol, boxe, jiu-jitsu, basquete, volei, corrida, natacao, tenis`.

### Profile — `GET /api/me`, `PUT /api/me`
`PUT` aceita `{name?, sports?: [{code}]}` (substitui esportes) → perfil completo.

### Exercises
- `GET /api/exercises/feed?sportIds=1,4&category=FORCA` — **ranking unificado**
  (requer esportes no perfil). Item: `{exerciseId, name, category, equipment, muscles[],
  bestScore, strongCount, scoreBySport{}, rationaleBySport{}}`. `q`/`category` são
  filtros opcionais aplicados **após** o ranking.
- `GET /api/exercises/{id}` — detalhe: `{id, name, category, equipment, muscleGroups[],
  steps[], sportLinks[{sport, score, why}]}`. 404 `NOT_FOUND` se inexistente.

### Routines
- `GET /api/routines` — minhas rotinas (mais recentes primeiro), com `items`.
- `POST /api/routines/generate` `{sportId}` — "treino do dia": esporte foco pesa 2×,
  cotas por categoria, até 7 exercícios (201).
- `POST /api/routines/{id}/items` `{exerciseId}` — adiciona item com preset da categoria
  (sem duplicar).
- `PATCH /api/routines/{id}/items/{exerciseId}` `{sets?, restTime?}`.
- `DELETE /api/routines/{id}` — 204.
- Rotina de outro usuário em qualquer operação → **404** (não vaza existência).

### Sessions
- `POST /api/routines/{routineId}/sessions` — cria sessão `PLANNED` a partir dos itens da rotina.
- `GET /api/sessions` — minhas sessões.
- `POST /api/sessions/{id}/start` — `IN_PROGRESS`.
- `PATCH /api/sessions/{id}` `{status?, durationMinutes?, sessionRpe?}` — `COMPLETED`
  preenche `completedAt`.
- `PATCH /api/sessions/{id}/items/{exerciseId}` `{completedSets?, loadKg?, itemRpe?}`.

### Readiness — `GET /api/readiness/today`, `PUT /api/readiness/today`
Check-in diário `{sleepHours?, sleepQuality?, stress?, muscleSoreness?, energy?,
motivation?, notes?}` → `{date, energyScore, totalScore, ...}`.

## Cobertura de testes

17 cenários de integração (MockMvc + Postgres `db-test`) cobrem: registro/login,
401/403 padronizados, fluxo completo de treino (perfil → feed → rotina → sessão →
readiness), validação 400 com `fields[]`, 404 de recurso inexistente e **IDOR**
(cross-user em rotinas/sessões/check-ins).