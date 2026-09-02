# Estrutura de Repositório: `frontend/` + `backend/` [UE-43]

> Épico de reorganização do repositório. Sem mudança de comportamento em runtime:
> nenhum arquivo de código foi editado, apenas movido (histórico Git preservado via rename).

## 1. Problema

| Problema | Evidência |
|---|---|
| Frontend "solto" na raiz do repositório (`src/`, `package.json`, `vite.config.js`, `index.html` etc. na raiz) enquanto o backend já vivia isolado em `backend/` | Listagem da raiz pré-migração |
| Assimetria: um app na raiz + outro em subpasta dificulta visualizar os limites do projeto | Comparação raiz × `backend/` |
| Convenção comum em monorepos de dois deployables: uma pasta de primeiro nível por app | Projetos profissionais de referência |

## 2. Mudança aplicada

Todo o app React + Vite foi movido para `frontend/`. O backend permanece inalterado.

### Antes × Depois

```
ultra-exercises/                      ultra-exercises/
├── index.html          →             ├── frontend/
├── package.json        →             │   ├── index.html
├── package-lock.json   →             │   ├── package-lock.json
├── vite.config.js      →             │   ├── vite.config.js
├── tsconfig.json       →             │   ├── tsconfig.json
├── eslint.config.js    →             │   ├── eslint.config.js
├── .env.example        →             │   ├── .env.example
├── public/             →             │   ├── public/
├── src/                →             │   └── src/
├── backend/            =             ├── backend/
├── docs/               =             ├── docs/
└── ...                               └── ...
```

### Detalhes

- Movimentação feita com `git mv` / detecção de rename pelo Git: **todos os arquivos registrados como `R` (rename)** — histórico e blame preservados.
- `node_modules/` e `dist/` movidos junto (não versionados).
- `.gitignore` **sem alteração**: padrões como `node_modules/` e `dist/` não são ancorados à raiz e continuam válidos em qualquer nível.
- Caminhos internos não precisaram de ajuste: `index.html` referencia `/src/main.tsx` e `vite.config.js` referencia `./src/test/setup.ts` — ambos relativos à própria pasta do app.

## 3. Arquivos ajustados

| Arquivo | Mudança |
|---|---|
| `README.md` | Comandos do frontend documentados a partir de `frontend/` (`cd frontend && npm install`, `npm run dev`, `npm test`); introdução atualizada citando as duas pastas |

## 4. Verificação (pós-migração)

| Check | Comando (em `frontend/`) | Resultado |
|---|---|---|
| Testes | `npm test` | ✅ 11 arquivos · **74/74 testes passando** |
| Build de produção | `npm run build` | ✅ built in 1.92s |
| Lint | `npm run lint` | ✅ 0 erros (`--max-warnings 0`) |

Backend não afetado (nenhum arquivo tocado).

## 5. Impacto para quem desenvolve

- Comandos do frontend agora rodam dentro de `frontend/`; comandos do backend seguem em `backend/`.
- Banco de dados: `docker compose up -d db` continua a partir de `backend/docker-compose.yml`.
- Portas inalteradas: frontend 3000 · API 8085 · Postgres 5433 (db-test 5434).

## 6. Fora de escopo (futuro)

- Workspaces (npm/pnpm workspaces, Nx/Turbo): complexidade desnecessária no tamanho atual do projeto.
- Pipeline/CI: sem workflows que referenciem caminhos antigos da raiz (verificado em `.github/`).
