# Monitoramento e Alertas [UE-33]

## O que existe

| Componente | Onde | Estado |
|---|---|---|
| Health público (`/actuator/health`, liveness, readiness) | Spring Boot Actuator | ✅ ativo e testado |
| Métricas Prometheus (`/actuator/prometheus`) | Micrometer | ✅ ativo (autenticado) |
| Uptime + latência a cada 5 min | `.github/workflows/monitoring.yml` | ✅ ativo; alerta quando secrets configurados |
| Regras de alerta (erros, latência, pool, heap) | `monitoring/prometheus-rules.yml` | 📦 as-code, aplicar no Prometheus |
| Dashboard de saúde em tempo real | `monitoring/grafana-health-dashboard.json` | 📦 importar no Grafana |
| Runbooks de incidentes | `docs/runbooks/` | ✅ 6 incidentes cobertos |

## Endpoints expostos

- `GET /actuator/health` — **público** (monitores de uptime); resposta mínima
  `{"status":"UP"}`, sem detalhes de componentes.
- `GET /actuator/health/liveness` e `/readiness` — públicos (probes).
- `GET /actuator/metrics` e `/actuator/prometheus` — **autenticados**
  (ver SecurityConfig); para o Prometheus raspar em produção, use um
  bearer token de serviço ou rede interna entre scraper e API.

## Setup da stack de observabilidade (quando houver hospedagem)

1. **Prometheus**: adicionar ao `prometheus.yml`:
   ```yaml
   scrape_configs:
     - job_name: forja-api
       metrics_path: /actuator/prometheus
       authorization:
         credentials: <token-de-serviço>
       static_configs:
         - targets: ["forja-api.exemplo.com:443"]
           labels: { application: "forja-api" }
   rule_files: ["/etc/prometheus/monitoring/prometheus-rules.yml"]
   ```
2. **Validar regras**: `promtool check rules monitoring/prometheus-rules.yml`.
3. **Grafana**: importar `monitoring/grafana-health-dashboard.json`
   selecionando o datasource Prometheus na importação.
4. **Alertmanager** (opcional): rotear os alerts por severity — critical →
   on-call imediato; warning → canal do time.

## Uptime e SLA 99,9%

- O workflow `Monitoring` roda a cada 5 minutos (288 checagens/dia por
  ambiente) e notifica Slack/Teams em falha — detecção ≤ 5 min.
- O SLA **autoritativo** deve ser medido por um monitor externo independente
  (UptimeRobot, Better Stack, etc.) apontando para `/actuator/health`;
  o workflow cobre detecção+alerta dentro do GitHub e serve como segunda
  camada. Com 99,9%, o orçamento é ~43 min de indisponibilidade/mês.
- Configure os secrets `STAGING_URL` e `PRODUCTION_URL` (raiz dos ambientes)
  para ativar as checagens — sem eles o job avisa e sai limpo.

## Thresholds vigentes

| Sinal | Limite | Fonte |
|---|---|---|
| Latência p95 | > 1,5s por 10 min | `prometheus-rules.yml` |
| Erros 5xx | > 5% por 5 min | `prometheus-rules.yml` |
| Latência no uptime check | > 2s por request | `monitoring.yml` |
| Pool Hikari | > 90% por 10 min | `prometheus-rules.yml` |
| Heap JVM | > 90% por 15 min | `prometheus-rules.yml` |
