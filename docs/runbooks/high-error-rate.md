# Runbook · Taxa de erro 5xx alta (> 5%)

**Alerta de origem:** `ForjaApiHighErrorRate` (critical)

## Sintomas
- `http_server_requests_seconds_count{status=~"5.."}` sustentado acima de 5%
  das requisições por 5 minutos
- Usuários reportando "algo deu errado" genérico

## Diagnóstico
1. **Qual endpoint e qual exceção?** Logs JSON têm `traceId`, rota e stack:
   filtrar por nível ERROR no último intervalo e agrupar por rota.
2. Padrões comuns neste stack:
   - `DataIntegrityViolationException` → payload violando constraint nova;
     checar última migração Flyway aplicada.
   - `QueryTimeoutException` / conexão recusada → banco sob pressão; ver
     [db-pool-saturation](db-pool-saturation.md).
   - `NullPointerException` em handler → regressão de código; identificar PR
     de origem pelo diff do endpoint.
3. Erro concentrado em um único endpoint após deploy recente?
   → rollback direto (ver [failed-deploy](failed-deploy.md)).

## Ação imediata
- Causa em deploy recente → **rollback primeiro**, investigar depois.
- Banco instável → aplicar mitigação do runbook de pool/banco.
- Sem causa óbvia e volume baixo → ativar rate-limit mais agressivo na rota
  afetada enquanto reproduz localmente.

## Verificação
- Taxa 5xx abaixo de 1% por 30 minutos no painel "Taxa de erro".
- Nenhum novo disparo de `ForjaApiHighErrorRate`.

## Escalação
- Erros intermitentes difíceis de reproduzir → issue com traceIds coletados
  dos logs para reprodução guiada.
