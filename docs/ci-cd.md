# CI/CD — Pipeline e Deploys [UE-31]

## Visão geral

```
PR (→ develop/main)          push develop                tag v* / manual
      │                            │                          │
      ▼                            ▼                          ▼
┌─────────── CI ───────────┐   Deploy Staging           Deploy Production
│ frontend  lint+tipos     │   (environment staging,    (environment production,
│           cobertura ≥80% │    automático após CI       aprovação manual de
│ e2e       fluxos críticos│    verde na develop)        revisor configurado)
│ backend   testes + ≥80%  │   artefato buildado        build na ref aprovada
│ build     só se testes ✓ │   pelo CI                  + placeholder de deploy
└──────────────────────────┘
```

## Jobs do CI (`.github/workflows/ci.yml`)

| Job | O que faz | Gate |
|---|---|---|
| `frontend-tests` | `npm run lint`, `npm run typecheck`, `npm run test:coverage` | Cobertura <80% em qualquer métrica falha o job (thresholds em `vite.config.js`) |
| `e2e-tests` | Playwright Chromium contra APIs mockadas (`npm run e2e`) | Fluxo crítico quebrado falha o job |
| `backend-tests` | `mvn -B -f backend/pom.xml verify` com Postgres 16 (porta 5434) | JaCoCo `check`: cobertura de linhas <80% falha o build |
| `build` | `npm run build` → artefato `frontend-dist` | Só roda **depois** dos três jobs de teste passarem |
| `notify` | Slack/Teams via webhook opcional | Silencioso se os secrets não existirem |

## Ambientes

### Staging (automático)
- Gatilho: workflow_run — CI concluído com sucesso em push na `develop`.
- Baixa o artefato `frontend-dist` construído pelo próprio CI (mesma proveniência).
- Environment `staging`, sem aprovação.

### Produção (aprovação manual)
- Gatilhos: tag `v*` ou disparo manual (`workflow_dispatch`).
- Environment `production` com **required reviewers** — configure em
  *Settings → Environments → production → Required reviewers*.
- Faz build fresco da ref aprovada e publica placeholder.

## Configuração necessária (uma vez)

1. **Environments**: criar `staging` e `production`; em `production`, adicionar
   revisor(es) obrigatórios. Sem isso o deploy de produção sai sem aprovação.
2. **Secrets opcionais** (Settings → Secrets and variables → Actions):
   - `SLACK_WEBHOOK_URL` — notificações Slack;
   - `TEAMS_WEBHOOK_URL` — notificações Teams.
   Ausentes = etapas de notificação puladas silenciosamente.
3. **Branch protection** (após o primeiro CI verde): exigir os checks
   `Frontend · lint, tipos e cobertura`, `E2E · fluxos críticos`,
   `Backend · testes e cobertura JaCoCo` e `Build do frontend` nas branches
   `main` e `develop`. Isso materializa o bloqueio de merge por cobertura.

## Onde plugar a hospedagem real

Os deploys hoje são **placeholders com gates reais** (environments, artefatos,
notificações). Para ativar uma hospedagem:

- **Vercel**: no job de deploy, instalar `vercel` e rodar
  `vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN` sobre o diretório do
  artefato (secret `VERCEL_TOKEN` + `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`).
- **Fly.io**: `flyctl deploy --remote-only` com `fly.toml` + secret `FLY_API_TOKEN`.
- **VPS/Docker**: construir imagem a partir de `dist/` (nginx) e publicar no
  GHCR; o servidor puxa a imagem (SSH action ou watchtower).

O ponto exato está marcado com `TODO: plugar aqui o comando real de deploy`
nos dois workflows de deploy.

## Rodando localmente

```bash
# Frontend: testes com gate de cobertura
npm ci && npm run test:coverage

# E2E (sobe o Vite automaticamente; APIs mockadas)
npx playwright install chromium && npm run e2e

# Backend: testes + gate JaCoCo (requer Postgres de teste)
docker compose -f backend/docker-compose.yml up -d db-test
mvn -B -f backend/pom.xml verify
```
