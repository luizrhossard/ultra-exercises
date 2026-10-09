# [UE-66] QA — Validação e Execução dos Casos de Teste de Dificuldade

Plano de testes da story **UE-49 — Adicionar campo de dificuldade ao exercício**
(épico UE-48). Cobertura executada na suíte de integração do backend
(`ExerciseDifficultyIntegrationTest`) e nos testes unitários/frontend.

## Contexto do produto

O catálogo é **curado por seed** (`seed/data.json` + `DataSeeder`): não existe CRUD
de exercícios na API. Por isso, os CTs de "cadastro/edição" foram validados no
nível em que o produto hoje permite: constraints de banco + contrato da API.
Quando uma story de CRUD administrativo existir, CT-01/CT-03 devem ser
re-executados nos fluxos de UI.

## Matriz de cobertura

| CT | Caso de Teste | Automação | Status |
| --- | --- | --- | --- |
| CT-01 | Cadastro com Dificuldade Válida (Caminho Feliz) | `ct01_seedClassifiesAllExercisesWithValidDifficulty` — os 22 exercícios do seed saem classificados (12 iniciante · 8 intermediário · 2 avançado) e a tag é exibida no card do frontend (unit: `Feed.test.tsx`) | ✅ Aprovado (adaptado: cadastro = seed curado) |
| CT-02 | Validação de Campo Obrigatório (Cenário Negativo) | `ct02_invalidDifficultyIsRejectedWithContractError` — valor inválido é bloqueado com 400 `BAD_REQUEST` + `traceId`; coluna `NOT NULL` + `CHECK` no banco impede registro sem dificuldade | ✅ Aprovado (adaptado: sem formulário de cadastro, a validação é de contrato/DB) |
| CT-03 | Edição e Atualização de Dificuldade | `ct03_detailMatchesCatalogDifficulty` — consistência entre catálogo e detalhe | ⚠️ Adaptado: sem CRUD de exercício na API; a edição por UI não existe ainda. Reexecutar quando houver story de administração |
| CT-04 | Filtro no Catálogo / API de Exercícios | `ct04_filterByDifficultyReturnsOnlyMatches` — `GET /api/exercises?difficulty=AVANCADO` (2), combinado com `category` (3) e `q` (0); sem filtro (22) | ✅ Aprovado |

## Camadas de verificação

1. **Banco (Flyway V6)** — coluna `difficulty varchar(16) NOT NULL`, constraint
   `ck_exercises_difficulty` (domínio fechado) e índice `idx_exercises_difficulty`
   para o filtro. Backfill determinístico por nome (nomes são `unique`).
2. **API** — `difficulty` exposto em `GET /api/exercises` (novo, com filtros
   `difficulty`/`category`/`q`), `GET /api/exercises/feed` e `GET /api/exercises/{id}`.
   Valor inválido no parâmetro → 400 pelo contrato de erro padrão.
3. **Frontend** — `difficultyToLevel` converte a dificuldade oficial da API no nível
   exibido no card (Iniciante/Intermediário/Avançado), com fallback para o catálogo
   local quando a API está indisponível (modo offline).

## Como executar

```powershell
# Backend (pré-requisito: Postgres de teste)
docker compose -f backend/docker-compose.yml up -d db-test
mvn clean test -f backend/pom.xml

# Frontend
npm test
```
