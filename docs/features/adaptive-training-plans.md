# Planejamento adaptativo de treinos

## Fluxo

Uma rotina é a prescrição planejada. Uma sessão guarda a cópia executável da prescrição e os registros reais de carga, RPE, dor, duração e estado. O atleta pode ajustar as séries, substituir movimentos compatíveis, iniciar, ignorar ou interromper uma sessão. Ao concluir, o sistema prepara uma recomendação provisória para o dia seguinte.

## Dados considerados

- Perfil: objetivo, dias disponíveis, duração, equipamento, preferências, limitações informadas e nível por esporte.
- Agenda: um dia sem disponibilidade configurada gera descanso; sem dias selecionados, a agenda permanece flexível.
- Histórico: exercícios concluídos nos últimos 14 dias perdem prioridade quando há alternativas. RPE de sessão ≥ 9 ou dor por exercício ≥ 5 nos últimos 7 dias aciona dose conservadora.
- Prontidão: check-in baixo ou `requiresReview` reduz séries, aumenta o descanso e remove as cotas de pliometria e condicionamento. Se a prontidão ainda não existe para uma data futura, o plano permanece provisório; uma chamada posterior para a mesma data pode ajustá-lo.
- Catálogo: substituições preservam categoria e esporte, além da dosagem do exercício substituído.

Os termos livres de limitações só excluem um movimento quando a pessoa escreve uma instrução explícita como `evitar <nome>` ou `sem <nome>`. Preferências livres podem priorizar um movimento usando `prefiro <nome>` ou `priorizar <nome>`. O motor é determinístico e não interpreta texto com IA.

## Idempotência e isolamento

`routines` e `training_sessions` guardam `plan_date` e têm índices únicos parciais por `user_id, plan_date`. A geração repetida devolve a mesma rotina; iniciar repetidamente uma rotina da mesma data devolve a sessão existente. A camada de aplicação resolve o usuário pelo JWT e todas as consultas de histórico e propriedade permanecem escopadas por esse usuário.

## Segurança do produto

As recomendações são apoio à decisão. Sinais de dor e esforço alto resultam em redução conservadora; não geram diagnóstico, aumento de carga ou compensação automática. A interface orienta revisão profissional quando o check-in exige atenção.

## Persistência e validação

A migração `V7__adaptive_training_plans.sql` adiciona os campos de perfil, data planejada, indicadores explicativos e estado de descanso, além de ampliar os estados da sessão. Testes unitários cobrem rotação, prontidão, disponibilidade, duração, idempotência, substituição e transições do histórico. O teste de integração que valida o índice único requer o PostgreSQL de teste na porta 5434.
