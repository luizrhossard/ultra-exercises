# Plano de Migração — Unificação da Arquitetura Backend

**Status: N/A (não se aplica)**

## Justificativa

A unificação da arquitetura (ADR-001) não é uma migração de dados, de
plataforma ou de API: o backend Java/Spring já é a fonte oficial de verdade
desde o início deste repositório (API e schema criados com o backend). O
trabalho deste épico foi de **integração e padronização** sobre a API
existente, sem mudança de schema (migrações Flyway `V1__init.sql` e
`V2__seed.sql` intocadas) e sem quebra de contrato.

## O que foi feito (não-migração)

| Item | Tipo de trabalho |
| --- | --- |
| Frontend passa a consumir `/api/exercises/feed` (ranking único no backend) | Integração |
| Contratos de erro padronizados (401/403/400/404/500) | Padronização |
| OpenAPI (springdoc) expondo a API | Documentação |
| Infra de teste com Postgres dedicado (`db-test`, porta 5434) | Infraestrutura de desenvolvimento |
| Testes de integração ≥ 80% dos endpoints críticos (17 cenários) | Qualidade |

## Riscos avaliados e descartados

- **H2 em modo PostgreSQL**: rejeitado — H2 não suporta `timestamptz`
  (migração V1 falha com SQL State HY004).
- **Testcontainers**: inviável nesta máquina — docker-java não conversa com os
  named pipes do Docker Desktop 29.x (respostas stub 400); o CLI do Docker
  funciona normalmente. Ver `backend-current-state.md`.
- **Migration plan formal (fases/rollback)**: desnecessário — não há etapa de
  migração a executar.

## Conclusão

Nenhum plano de migração é necessário. Se no futuro houver unificação de
bancos, replicação ou troca de provider, este documento deve ser substituído
pelo plano real correspondente.