# Runbook · Deploy falhou ou versão ruim em produção

**Alertas de origem:** workflow `Deploy Production` (failure) · sintomas via [service-down](service-down.md) ou [high-error-rate](high-error-rate.md)

## Sintomas
- Workflow de deploy vermelho
- Após deploy concluído: erros 5xx, DOWN no uptime, ou comportamento incorreto

## Diagnóstico
1. **Deploy falhou antes de publicar?** Log do job aponta a etapa
   (build, migração Flyway, health check pós-deploy).
2. **Migração Flyway rejeitada?** Erro típico: schema divergente. NÃO editar
   migração já aplicada — criar nova migração corretiva.
3. **Versão publicada com defeito?** Correlacionar início dos erros com o
   horário do último `Deploy Production` e o SHA publicado.

## Ação imediata
- **Rollback é sempre a primeira opção** em produção:
  reexecutar o deploy apontando para o tag anterior estável
  (`vX.Y.Z-1`) — o pipeline faz build fresco da ref aprovada.
- Falha de migração → corrigir com migração nova; nunca reaproveitar checksum.
- Health check pós-deploy falhando → aguardar 2 tentativas antes de rollback;
  pode ser aquecimento de JVM.

## Verificação
- `/actuator/health` UP na versão anterior restaurada.
- Taxa de erro e latência normalizadas nos painéis.

## Escalação
- Rollback também instável → incidente ativo: congelar deploys, coletar logs,
  acionar responsável pelo último change set.
