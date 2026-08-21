# Otimização de Performance (UE-34 / UE-35 / UE-36)

## 1. Problemas detectados

| Problema | Evidência |
|---|---|
| Bundle único gigante: todo o app (8 telas + framer-motion) em 1 arquivo JS | Baseline: 353.19 kB (gzip 111.08 kB) |
| Fontes carregadas do Google Fonts (CORS, DNS/connnect externos, risco de indisponibilidade) | `index.html` com `<link>` para fonts.googleapis.com |
| 9 dependências instaladas com zero imports em `src/` (dnd-kit, recharts, react-router-dom, date-fns, lucide-react, canvas-confetti, uuid) | `package.json` × `rg` em `src/` |
| Feed: cards animados individualmente (framer-motion `layout`/entrance escalonado) → jank de scroll em mobile | `Feed.tsx` pré-otimização |
| Refeitório: perfil/rotinas/esportes re-buscados da API a cada navegação; sem cache | `store.tsx`/`Routines.tsx` pré-otimização |
| Zero testes automatizados e zero lint no projeto | `package.json` sem scripts lint/test |

## 2. Soluções aplicadas

- **UE-36 (bundle/assets):** `React.lazy` + `Suspense` para as 8 telas em `App.tsx` (code splitting por rota/tela); remoção das 9 dependências não usadas; fontes self-hosted (`src/assets/fonts/*.woff2`) com `@font-face` em `src/index.css` e `preload` no `index.html`.
- **UE-35 (cache):** módulo próprio `src/cache.ts` (localStorage, sem biblioteca externa):
  - Chaves isoladas por usuário: `forja:cache:v1:{userKey}:{key}` com `userKey = djb2(token)` — token nunca é persistido.
  - TTLs: profile 5min, sports 24h, routines 2min, readiness 2min.
  - SWR via hook `src/hooks/useCachedQuery.ts` (dado em cache renderiza na hora + revalidação em background + `refresh()` forçado).
  - `dedupeFetch()` deduplica requisições em voo (uma só por chave).
  - `clearCache()` no logout e no novo login; `invalidate(userKey, pattern)` após mutações (`/routines/`, `/me/`).
  - `store.tsx`: `me()` passa a usar cache; o perfil é hidratado do cache no inicializador do estado (render instantâneo para usuários recorrentes); `authLoading` deriva da existência de cache.
- **UE-34 (listas longas):** hook `src/hooks/useProgressiveList.ts` (pageSize 12, `minLoadMs` 350 no Feed) com IntersectionObserver; `ExerciseCard`/`RoutineCard` memoizados; skeletons; estado de fim de lista; erro + retry; botão "Carregar mais" de fallback; remoção das animações escalonadas por item (mantidas apenas as de transição de tela).

## 3. Cache: TTLs, invalidação e segurança

- **Chaves:** `forja:cache:v1:{userKey}:{key}` — `userKey` é hash djb2 do token; **nenhum token ou senha é armazenado**.
- **TTLs:** profile 5min · sports 24h · routines 2min · readiness 2min.
- **Invalidação:** `invalidate(userKey, /routines/)` ao gerar treino; `invalidate(userKey, /me/)` + `setCache` ao concluir onboarding; `clearCache()` (total) no login novo e no logout.
- **Segurança:** dados de um usuário nunca vazam para outro (chave inclui hash do token); troca de conta limpa o cache; cache nunca contém credenciais.
- **Fluxo:** `useCachedQuery` → cache fresco → render imediato + revalidação em background; cache expirado → render stale + revalidação; sem cache → loading + fetch; falha com cache existente → mantém sessão/dados; falha sem cache → trata como erro.

## 4. Telas e componentes modificados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | `React.lazy` + `Suspense` + `ScreenFallback`; `<Player key={playerId}>` (reset do player via remontagem, sem effect) |
| `src/screens/Feed.tsx` | Lista incremental com `useProgressiveList`; cards memo; skeletons; fim/erro/retry; botão "Carregar mais" |
| `src/screens/Routines.tsx` | `useCachedQuery` para esportes e rotinas; `RoutineListSkeleton`; geração invalida cache + refresh |
| `src/screens/Player.tsx` | Remoção de imports não usados e do effect de reset (substituído por `key`) |
| `src/store.tsx` | Cache no `me()`; hidratação do perfil no inicializador; `clearCache` no login/logout; `invalidate` no onboarding |
| `src/components/ReadinessCard.tsx` | `useCachedQuery` para readiness; save grava cache direto |
| `src/screens/Onboarding.tsx` | Toast de erro no lugar de estado morto |
| `src/index.css` / `index.html` | `@font-face` self-host + `preload` das fontes |

## 5. Dependências e tooling

**Removidas (9):** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `canvas-confetti`, `date-fns`, `lucide-react`, `recharts`, `react-router-dom`, `uuid` — todas sem imports em `src/`.

**Adicionadas (devDependencies):** `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `globals` (lint), `vitest` + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` (testes).

**Scripts:** `npm run lint` (eslint src, 0 warnings), `npm run test` (vitest run), `npm run typecheck`, `npm run build`.

## 6. Antes × Depois (build de produção, Vite 6)

| Métrica | Antes | Depois | Δ |
|---|---|---|---|
| JS total (1ª carga, gzip) | 111.08 kB | 92.12 kB (index) | −17% |
| JS total (raw) | 353.19 kB | 281.95 kB (index) | −20% |
| CSS (gzip) | 42.33 kB (8.7 kB gz) | 43.21 kB (8.70 kB gz) | ~neutro |
| Fontes | Google Fonts (rede externa) | self-host 18.61 + 22.29 kB | 0 request externo |
| Telas | todas no bundle único | chunks por tela (Auth 2.61, Onboarding 6.89, Feed 8.76, Routines 8.13, Profile 8.85, Project 13.19, Player 10.57 kB) | carregadas sob demanda |
| Dependências runtime | 15 | 6 | −9 |

## 7. Lighthouse (vite preview, Chrome headless, desktop)

| Métrica | Valor |
|---|---|
| Performance | **99/100** |
| First Contentful Paint | 1.5s |
| Largest Contentful Paint | 2.0s |
| Speed Index | 1.5s |
| Total Blocking Time | 0ms |
| Cumulative Layout Shift | 0 |

## 8. Pendências

- [ ] Audit final do épico (UE-34/35/36) — status de conclusão formal.
- [ ] Medir com Lighthouse em mobile + rede real (4G throttling) em CI, se desejado.
- [ ] Opcional: transformar `useProgressiveList` em componente genérico de lista infinita.
- [ ] Opcional: pré-carregar (`<link rel="modulepreload">`) o chunk da aba mais provável após interação.