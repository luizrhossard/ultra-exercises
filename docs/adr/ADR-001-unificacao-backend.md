# ADR-001 — Unificação da Arquitetura Backend

- Status: Aceito
- Data: 2026-08-20
- Responsável: Time de Engenharia

## Contexto

O projeto "ultra-exercises" (agendamento de treinos esportivos) nasceu com duas abordagens de backend em snapshots iniciais: um protótipo integrado ao **Supabase** (`@supabase/supabase-js@^2.98.0`, presente nos snapshots `7b8ef47`, `1195c8e`, `f5a0e58`, `a330a5f`) e um backend **Java/Spring Boot** próprio. A duplicidade gera risco de regras de negócio divergentes, fontes de verdade múltiplas, custo maior de manutenção e confusão operacional.

O diagnóstico formal (`docs/architecture/backend-current-state.md`, 2026-08-20) demonstrou, com evidência do repositório, que a duplicidade já foi resolvida na prática: **o código atual não contém nenhuma referência a Supabase** (grep = 0 no working tree e em `package-lock.json`); a consolidação para Spring ocorreu no commit `63b7edc` (merge `ccb519e`). O que existe de fato é um backend único (Spring Boot 3.3.5 + PostgreSQL 16 + Flyway + JWT) e uma duplicidade remanescente de catálogo/regra de ranqueamento entre o banco curado e a cópia local `src/data/*` no frontend.

## Decisão a ser tomada

Escolher uma arquitetura oficial:

- **Opção A: React + Supabase como backend principal.**
- **Opção B: Java + Spring como backend principal.**

## Critérios de avaliação

| Critério | Supabase (A) | Java/Spring (B) |
|---|---|---|
| Maturidade da implementação atual | **Inexistente** — protótipo descartado; zero código no repo (evidência: grep=0, dep removida) | **Alta** — backend completo em produção local: 7 controllers, 2 services, 8 repositories, 19 endpoints |
| Cobertura de requisitos de negócio | Nenhuma implementada | Feed ranqueado, geração de rotinas por prescrição, sessões, readiness, perfil — implementados e testados |
| Segurança e controle de autorização | Dependeria de RLS + policies (a criar do zero) | JWT HS256 + BCrypt + ownership por usuário nos controllers (IDOR bloqueado em código), CORS restritivo |
| Facilidade de manutenção | Recomeço em outra plataforma | Continuação do stack atual, com estrutura por camadas |
| Escalabilidade | Boa (gerenciada) | Boa (PostgreSQL + Spring stateless; adequado ao porte) |
| Custo operacional | Baixo inicial, mas lock-in de fornecedor | Controle total; PostgreSQL via Docker; custo = infra própria |
| Velocidade de desenvolvimento | Reimplementação completa necessária | Iteração incremental (melhorias pontuais) |
| Observabilidade | Métricas próprias do Supabase | Logs estruturados + health check (a adicionar) |
| Testabilidade | Menor (menos ferramentas de teste local) | 28 testes existentes (JUnit/Mockito/AssertJ) + caminho para integração |
| Documentação | A criar | README + contratos já descritos; OpenAPI a adicionar |
| Integração com o frontend | Migração total do cliente HTTP | `src/api.ts` já consome `/api/**` — zero mudança de contrato |
| Risco de migração | Alto (reescrever backend inteiro) | Baixo (formalização + melhorias) |
| Experiência e domínio técnico do time | Não evidenciada no repo | Evidenciada: código Java bem estruturado e testado |
| Regras de negócio complexas | Simples demais para o domínio (prescrição × execução, scoring) | Suporta domínio rico: ranking, presets, regras de transição de status |
| Jobs, filas, integrações assíncronas | Edge Functions limitadas | Spring permite jobs/async quando necessário |
| Dependência de fornecedor / portabilidade | Alto lock-in (Auth, Storage, Edge) | Portável (Spring Boot padrão da indústria) |

## Alternativas consideradas

- **Manter Supabase como backend:** rejeitada — exigiria reconstruir todo o domínio (auth, feed, rotinas, sessões, readiness) e as RLS policies a partir do zero, sem qualquer código existente para aproveitar. O estado real do repo não justifica a migração.
- **Manter Java/Spring como backend:** escolhida — é a única implementação existente, madura, com testes e já integrada ao frontend.
- **Manter arquitetura híbrida (Spring API + Supabase como Postgres/Auth/Storage):** rejeitada — sem justificativa técnica no projeto: não há Storage, Auth ou jobs que exijam o Supabase; o Spring já provê auth (JWT) e o PostgreSQL (Docker) já é o banco. Hibridismo aqui criaria sobreposição de responsabilidades sem ganho.
- **Outras alternativas (BaaS alternativos, microservices, serverless):** descartadas por complexidade desproporcional ao porte do produto.

## Decisão

**Opção B — Java + Spring Boot como backend oficial e única fonte de verdade** (regras de negócio, persistência, autenticação, validação, APIs consumidas pelo frontend, testes, deploy).

Justificativa: baseada em evidências do repositório, não em preferência tecnológica — (1) é a única implementação existente e funcional; (2) Supabase nunca passou de protótipo descartado; (3) o frontend já consome exclusivamente `/api/**` via `src/api.ts`; (4) a consolidação restante é pontual: eliminar a duplicidade do catálogo (feed passando a consumir `GET /api/exercises/feed`), padronizar erros, adicionar OpenAPI e ampliar testes de integração.

## Consequências positivas

- Uma única fonte de verdade para domínio, persistência, auth e validação.
- Regra de ranqueamento do feed passa a viver apenas no backend (removendo `rankFor`/`bestLink` duplicados no frontend).
- Erros padronizados (`ErrorResponse`) em toda a API — frontend com mensagens consistentes.
- OpenAPI/Swagger UI gerado — contrato público e auditável.
- Cobertura de testes de integração ≥ 80% dos endpoints críticos, incluindo cenários de segurança (401, IDOR).
- README e documentação com uma única forma de subir o projeto.

## Consequências negativas e riscos

- Dados locais do catálogo continuam em `src/data/*` para telas auxiliares (Player/Profile/Project/Onboarding/Sidebar) — débito técnico registrado; o Feed passa a usar a API.
- JWT caseiro (HS256 manual) — aceito no porte atual; monitorar necessidade de biblioteca madura (jjwt) se a API crescer.
- Sem CI/CD — validações continuam manuais até a criação de workflow (fora do escopo deste épico).
- springdoc adiciona dependência Java (impacto pequeno no build).

## Plano de implementação

1. Fase 1 — Diagnóstico: `docs/architecture/backend-current-state.md` ✔
2. Fase 2 — ADR (este documento) ✔
3. Fase 3 — Consolidação: feed do frontend passa a consumir `GET /api/exercises/feed` (cache SWR já existente) com fallback local; `@Valid` faltantes; camada global de exceções; OpenAPI (springdoc).
4. Fase 4 — Segurança: 401/403 com corpo padronizado; revisão de ownership (já ok em código); `.env.example` sem segredos (já ok).
5. Fase 5 — API: spec OpenAPI gerada + `docs/api/openapi.md`.
6. Fase 6 — Migração: **não aplicável** (sem dados Supabase em produção) — plano documentado em `docs/migrations/backend-unification-migration-plan.md`.
7. Fase 7 — Remoção: nada a remover no working tree (protótipo Supabase já descartado); `src/data/*` mantido como fallback e para telas auxiliares; README atualizado.
8. Verificação: `mvn test`/`package` + smoke E2E (docker compose + spring-boot:run) + `npm run lint/typecheck/test/build`.

## Plano de reversão

- **Backend:** as mudanças são incrementais (handler de erro, springdoc, testes) — reversão = reverter os commits, sem migração de dados (nenhuma mudança de schema).
- **Frontend:** o Feed mantém o fallback local; reverter = voltar `Feed.tsx` ao uso de `src/data/*` (a função `rankFor`/`bestLink` é preservada no módulo de dados até a validação completa da API).
- **Dados:** nenhuma migração destrutiva; nenhuma exclusão de tabela ou seed.

## Critérios de sucesso

- ADR aprovada e arquitetura oficial definida (Spring) ✔
- Nenhuma duplicidade não justificada de regra de negócio (feed 100% via API com fallback).
- API documentada em Swagger/OpenAPI acessível.
- ≥ 80% dos endpoints críticos com testes de integração (incluindo 401/IDOR/validação).
- Build, lint e testes (frontend e backend) verdes.
- Uma única forma de subir o projeto (README).
- Logout/login limpa dados privados (cache) — já coberto por testes.