# Runbook · Pool de conexões do banco saturado (Hikari > 90%)

**Alerta de origem:** `ForjaDbConnectionPoolSaturated` (warning)

## Sintomas
- `hikaricp_connections_active / hikaricp_connections_max > 0.9` por 10 min
- Requisições lentas majoritariamente em endpoints que tocam o banco
- Possível `Connection is not available, request timed out after 30000ms`

## Diagnóstico
1. Painel **"Pool de conexões"**: ativas encostadas no máximo é padrão de
   vazamento ou de queries lentas retendo conexão.
2. `pg_stat_activity`: contagem por estado e query mais longa:
   ```sql
   SELECT pid, state, now() - query_start AS duracao, left(query, 80)
   FROM pg_stat_activity WHERE state <> 'idle' ORDER BY duracao DESC;
   ```
3. Transações longas abertas (`idle in transaction`) → código segurando
   conexão fora do escopo esperado (`open-in-view` já é false neste stack).
4. Correlacionar com deploy recente: novo endpoint com N+1 consultas?

## Ação imediata
- Queries runaway → `pg_cancel_backend(pid)` nas mais longas.
- Carga legítima acima do previsto → aumentar `maximum-pool-size`
  (padrão 10) com folga real no `max_connections` do Postgres, via variável
  de ambiente, e reiniciar a API.
- Suspeita de vazamento → reiniciar a API recicla todas as conexões;
  registrar traceIds afetados para investigação posterior.

## Verificação
- Ativas abaixo de 70% do máximo por 30 minutos.
- Latência p95 normalizada (ver [high-latency](high-latency.md)).

## Escalação
- Vazamento confirmado em código → issue com endpoint suspeito e heap dump
  se necessário; considerar `leakDetectionThreshold` temporário no Hikari.
