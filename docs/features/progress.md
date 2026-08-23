# Progresso do atleta

## Objetivo

A aba **Progresso** substituiu a antiga aba técnica "Projeto" (blueprint interno),
dando ao atleta um lugar para acompanhar sua evolução com dados reais do sistema:
resumo semanal, histórico de sessões de treino e tendência de prontidão.
O conteúdo técnico permanece disponível no repositório (`docs/`) e fora da interface.

## Rotas de frontend

- Entrada **Progresso** na navegação principal (BottomNav mobile e Sidebar desktop),
  id `progresso`, tipo `Tab` em `src/types.ts`.
- O app não usa URL router: a navegação é estado interno (`store.tsx`), com default
  `"explorar"` e **sem persistência da aba** — portanto não existe URL antiga a
  redirecionar e nada quebra com a remoção de "Projeto".
- Renderização condicional em `src/App.tsx` (`tab === "progresso"`), com chunk lazy
  próprio (`screens/Progress`). A tela só é montada com sessão autenticada
  (o App exibe login/onboarding antes das abas).

## Métricas exibidas

Somente métricas calculáveis a partir dos dados reais do backend:

| Bloco | Fonte | Métricas |
| --- | --- | --- |
| Resumo semanal | `GET /api/progress/weekly-summary` | Treinos concluídos, duração total, volume total, RPE médio, prontidão média (+ variação vs semana anterior) |
| Tendência de prontidão | `GET /api/progress/readiness-trend` | Série temporal `data → score` (7/30/90 dias selecionáveis) |
| Histórico | `GET /api/progress/sessions` | Data, rotina/esporte, status, duração, RPE, volume, séries × exercícios, dor máxima |

Variação vs semana anterior é exibida **somente com base histórica comparável**:
contagens exigem semana anterior com pelo menos uma sessão concluída; médias exigem
valor presente nas duas semanas.

## Regras de cálculo

- **Volume**: Σ(`loadKg` × `completedSets`) dos pares preenchidos; execução incompleta entra parcialmente.
- **setCount**: Σ `coalesce(completedSets, prescribedSets)`; **exerciseCount**: nº de itens da sessão.
- **maxPainLevel**: maior `pain_level` entre os itens (nulo se nenhum registrado).
- **readinessScore**: `sleepQuality*2 + (6-fatigue)*2 + (6-stress) + (6-soreness)` — escala 6–30,
  mesma fórmula do check-in diário (centralizada em `ReadinessCheckin.getReadinessScore()`).
- **Semana**: segunda a domingo no fuso do servidor; sessões contadas por `completedAt`
  dentro da janela, exclusivamente com status `COMPLETED`.
- **Médias** (`averageRpe`, `averageReadiness`) são nulas quando não há base — nunca viram zero artificial.

## Estados da interface

- Loading inicial com skeletons por bloco (resumo, tendência, histórico).
- Loading de paginação ("Carregando…" no botão Carregar mais).
- Estado vazio amigável (histórico e tendência têm mensagens próprias).
- Erro de rede com **retry** por bloco (`role="alert"` + "Tentar novamente").
- Sessão expirada: mensagem específica convidando a entrar novamente.
- Dados parciais: cada bloco carrega/falha de forma independente (resumo pode estar
  disponível enquanto o histórico falha, e vice-versa).

## Acessibilidade

- Hierarquia semântica: `h1` na tela, seções com rótulos visíveis; listas `<ul>`/`<dl>` no histórico.
- Gráfico SVG com `role="img"` e `aria-label` resumindo período, nº de registros e média;
  alternativa textual completa (`sr-only`) com `data: valor` de cada ponto.
- Botões com rótulos claros ("Carregar mais", "Tentar novamente", período com `aria-pressed`).
- Status não depende só de cor: chips trazem texto ("Concluída", "Planejada") e variações usam ▲/▼ com texto.
- Navegação por teclado nativa (elementos `<button>`); tooltips nativos `<title>` nos pontos do gráfico.

## Responsividade

- Mobile-first: cards do resumo em `grid-cols-2 → sm:grid-cols-3 → lg:grid-cols-5`.
- Itens do histórico empilham e truncam nomes longos; legíveis em viewport reduzida.
- Gráfico SVG fluido via `viewBox` (largura adaptável, altura fixa).
- Sem overflow horizontal involuntário (validado nos breakpoints mobile/tablet/desktop).

## Estados vazios e erros

- Histórico vazio: "Você ainda não registrou treinos concluídos. Complete sua primeira
  sessão para começar a acompanhar sua evolução."
- Tendência vazia: orienta registrar o check-in diário; nenhum valor é inventado em dias sem check-in.
- Erros: card com `role="alert"`, mensagem específica (rede vs sessão expirada) e retry seguro.

## Segurança e privacidade

- Todos os dados partem do usuário autenticado (JWT); nenhum `userId` é aceito do cliente.
- Cache local (`forja:cache:v1`) isolado por hash do token, TTL de 60 s para progresso;
  invalidado ao concluir uma sessão (`Routines.tsx` chama `invalidate(userKey, /progress/)`).
- Requisições passam pelo wrapper `request()` (timeout, retry só em GET idempotente, mensagens genéricas).

## Dados não exibidos

Notas da sessão e dos itens, `painArea`, prescrição item a item, identificadores internos
além do necessário, dados de outros usuários e qualquer conteúdo técnico/arquitetura do produto.

## Limitações conhecidas

- A paginação do histórico usa `@EntityGraph` com coleção + `Page`; o Hibernate aplica
  paginação em memória (aviso `HHH90003004`). Adequado à escala atual; migrar para duas
  queries (ids paginados + fetch) se o histórico por atleta crescer ordens de grandeza.
- Fuso da semana/resumo é o do servidor (`ZoneId.systemDefault()`).
- Tendência limitada a 7–90 dias e sem interpolação: dias sem check-in simplesmente não aparecem.
