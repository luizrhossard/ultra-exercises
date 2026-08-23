# Endpoints de Progresso [UE-42]

Contrato dos endpoints que alimentam a aba **Progresso** do atleta.
Contrato geral de erros: [error-response-contract.md](error-response-contract.md) ·
Resumo OpenAPI: [openapi.md](openapi.md) · Swagger vivo: `/swagger-ui/index.html`.

## Autenticação e autorização

- **Obrigatória** em todos os endpoints abaixo (`Bearer` JWT no header `Authorization`).
  `/api/progress/**` não está em `permitAll` — cai em `anyRequest().authenticated()`.
- `401 UNAUTHORIZED` sem token; `403 FORBIDDEN` em acesso negado (ambos no formato `ErrorResponse` com `traceId`).
- **Isolamento por JWT**: o filtro é sempre o usuário do token (`Authentication` → `app_user` por e-mail).
  Nenhum endpoint aceita `userId` via query, path ou body. Não existe IDOR conhecido — coberto por teste.
- **Rate limiting**: escopo `authenticated` existente (`RateLimitFilter`, aplicado após `JwtAuthFilter`).
- **Observabilidade**: um evento estruturado por requisição (método, path, status, duração) com
  `traceId` no MDC (`RequestLoggingFilter` + `TraceIdFilter`). Nenhum payload, RPE, dor ou nota é logado.

---

## GET /api/progress/sessions

Histórico paginado de sessões do atleta autenticado.

### Query params

| Param | Default | Regras |
| --- | --- | --- |
| `page` | `0` | ≥ 0 |
| `size` | `20` | 1–50 (limite máximo seguro) |
| `from` | — | opcional, ISO `yyyy-MM-dd`; janela sobre `scheduledAt` (inclusiva) |
| `to` | — | opcional, ISO `yyyy-MM-dd`; fim inclusivo (dia inteiro); `from ≤ to` |

Ordenação fixa: `scheduledAt desc, id desc`. Consultas sem limite não existem.

### Resposta 200

```json
{
  "items": [
    {
      "id": 27,
      "routineName": "Treino Futebol — 22/08",
      "sportName": "Futebol",
      "status": "COMPLETED",
      "scheduledAt": "2026-08-22T18:00:00Z",
      "completedAt": "2026-08-22T19:05:00Z",
      "durationMinutes": 58,
      "sessionRpe": 8,
      "maxPainLevel": 2,
      "totalVolumeKg": 12450.00,
      "exerciseCount": 6,
      "setCount": 18
    }
  ],
  "page": 0,
  "size": 20,
  "totalItems": 42,
  "totalPages": 3,
  "hasNext": true
}
```

Regras dos campos: `routineName` nulo quando a sessão não tem rotina; `totalVolumeKg` =
Σ(`loadKg` × `completedSets`) dos pares preenchidos; `setCount` = Σ `coalesce(completedSets,
prescribedSets)`; `maxPainLevel` = maior `pain_level` dos itens (nulo se nenhum). Campos nulos
são omitidos (`default-property-inclusion: non_null`).

### Erros

| Status | `error` | Causa |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `page < 0`, `size < 1` ou `size > 50` |
| 400 | `BAD_REQUEST` | `from > to`, data fora do ISO, parâmetro inválido |
| 401 | `UNAUTHORIZED` | sem token/token inválido |

---

## GET /api/progress/weekly-summary

Resumo da semana atual (seg–dom, fuso do servidor) e da anterior.

### Resposta 200

```json
{
  "periodStart": "2026-08-17",
  "periodEnd": "2026-08-23",
  "current": {
    "sessionsCompleted": 4,
    "totalDurationMinutes": 242,
    "totalVolumeKg": 39200.00,
    "averageRpe": 7.5,
    "averageReadiness": 23.4
  },
  "previous": {
    "sessionsCompleted": 2,
    "totalDurationMinutes": 120,
    "totalVolumeKg": 18000.00,
    "averageRpe": null,
    "averageReadiness": null
  }
}
```

Regras: contam apenas sessões `COMPLETED` com `completedAt` dentro da semana;
`averageRpe`/`averageReadiness` são **nulos** quando não há base (nunca zero artificial);
`averageReadiness` usa o mesmo score do check-in diário (escala 6–30).

---

## GET /api/progress/readiness-trend

Série temporal de prontidão para gráfico.

### Query params

| Param | Default | Regras |
| --- | --- | --- |
| `days` | `30` | 7–90 (fora da faixa → 400) |

### Resposta 200

```json
{
  "periodDays": 30,
  "items": [
    { "date": "2026-08-20", "readiness": 24 },
    { "date": "2026-08-21", "readiness": 21 }
  ]
}
```

Regras: ordenação crescente por data; **somente dias com check-in** (sem interpolação);
lista vazia é resposta válida para atleta sem check-ins.

---

## Formato de erro (`ErrorResponse`)

Todos os erros seguem o contrato central (`docs/api/error-response-contract.md`):

```json
{
  "timestamp": "2026-08-22T21:06:06Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dados inválidos.",
  "fields": [{ "field": "size", "message": "deve ser menor que ou igual a 50" }],
  "traceId": "8dbc9042-7691-415c-b3b1-7183c59accd5"
}
```

`traceId` é sempre igual ao header `X-Trace-Id` da resposta.

## Testes de cobertura

`ProgressControllerIntegrationTest` (integração, Postgres dedicado): 401 sem token;
isolamento entre usuários e tentativa de IDOR (404); paginação (`page`/`size`/`hasNext`);
rejeição de `size > 50`, `page < 0`, datas inválidas e `from > to`; janela por data;
agregação do resumo semanal sobre seed real; limites e ordem da tendência; estados vazios.
