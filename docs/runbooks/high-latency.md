# Runbook · Latência alta (p95 > 1,5s)

**Alerta de origem:** `ForjaApiHighLatencyP95` (warning) · **Check de latência:** workflow `Monitoring`

## Sintomas
- p95 das requisições acima de 1,5s sustentado por 10 minutos
- Relatos de lentidão sem erros explícitos

## Diagnóstico
1. Painel **"Latência p95"**: a lentidão é de qual endpoint?
   - `GET /api/exercises/feed` → provável consulta pesada do feed;
   - endpoints de escrita → contenção de transação/lock no Postgres.
2. Painel **"Pool de conexões"**: ativas encostando no máximo?
   Sim → trate como [db-pool-saturation](db-pool-saturation.md).
3. Painel **"JVM heap"**: GC thrashing (serra denteada próxima do máximo)?
   Sim → trate como [jvm-memory-pressure](jvm-memory-pressure.md).
4. `pg_stat_activity` no banco: queries longas (`state = 'active' AND now() - query_start > '2s'`)?

## Ação imediata
- Query lenta identificada → adicionar índice (migração Flyway) ou otimizar
  a consulta; em emergência, `pg_cancel_backend(pid)` na query runaway.
- Carga acima do previsto → escalar verticalmente a instância (CPU/RAM)
  enquanto um fix estrutural é preparado.
- Sem causa interna → verificar latência de rede/provedor entre API e banco.

## Verificação
- p95 abaixo de 500ms por 30 minutos no painel.
- Sem novos disparos de `ForjaApiHighLatencyP95`.

## Escalação
- Latência crônica (> 3 episódios/semana) → issue de capacidade com gráficos
  anexados; avaliar cache do feed e paginação.
