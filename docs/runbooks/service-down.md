# Runbook · Serviço fora do ar

**Alerta de origem:** `ForjaApiDown` (critical) · **Check:** workflow `Monitoring` (uptime a cada 5 min)

## Sintomas
- `up{job="forja-api"} == 0` por mais de 1 minuto
- Workflow Monitoring falhando com "DOWN — HTTP 000/5xx"
- Aplicação inacessível para usuários

## Diagnóstico
1. **O processo está de pé?** No host/provedor: `systemctl status forja-api`
   ou painel do provedor (crash loop? OOM kill?).
2. **Porta escutando?** `ss -tlnp | grep 8085` — se não escuta, o processo
   morreu; se escuta e não responde, é rede/firewall.
3. **Últimas linhas do log** (`journalctl -u forja-api -n 100`): procurar
   `OutOfMemoryError`, falha de conexão com banco na inicialização, ou erro
   de migração Flyway.
4. **Deploy recente?** Workflow `Deploy Production`/`Deploy Staging` concluiu
   há pouco? → tratar como [failed-deploy](failed-deploy.md).

## Ação imediata
- Processo morto sem causa clara → reiniciar:
  `systemctl restart forja-api` (ou Restart no provedor).
- Reinício em crash loop → **não insistir**: congelar versão anterior
  (rollback) e preservar logs para análise.
- Banco inacessível → subir/recuperar Postgres antes da API; a API sobe mas
  fica DOWN no health enquanto o datasource estiver indisponível.

## Verificação
- `/actuator/health` respondendo HTTP 200 `{"status":"UP"}`.
- Painel "Instâncias UP" verde; workflow Monitoring passando 3× seguidas.

## Escalação
- Segundo DOWN em 24h → issue obrigatória com timeline completa
  (horários, logs, ações) e post-mortem curto.
