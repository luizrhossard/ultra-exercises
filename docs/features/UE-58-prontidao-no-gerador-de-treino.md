# UE-58 — Check-in de prontidão no gerador de treino

## Sinal de prontidão do dia

O gerador consulta o check-in do usuário para a data atual. Sem check-in, mantém a seleção e as prescrições padrão. A pontuação existente varia de 6 a 30; pontuação **≤ 15** caracteriza prontidão baixa.

`requiresReview` é verdadeiro quando dor, fadiga ou dor muscular têm valor **≥ 5**. Esse sinal aciona a versão conservadora da rotina mesmo se a pontuação geral for alta.

## Ajustes quando a rotina deve ser conservadora

- Limita a rotina a **até cinco exercícios**.
- Seleciona no máximo um exercício de força, core e específico, e até dois de mobilidade.
- Não reserva vagas para pliometria ou condicionamento.
- Reduz séries para metade, arredondando para cima e mantendo no mínimo uma série; aumenta o descanso em 25%.
- Mantém uma vaga para um exercício técnico da modalidade quando houver opção vinculada, sem substituir o check-in por diagnóstico.

A regra é aplicada quando a pontuação é baixa **ou** quando `requiresReview` está ativo. Dor/fadiga sinalizada resulta também numa recomendação explícita para rever a sessão com um profissional antes de iniciar.

## Resposta e interface

`POST /api/routines/generate` inclui `readinessScore`, `readinessAdjusted`, `requiresReview` e `reviewRecommendation` na resposta. A interface informa quando o treino foi ajustado e exibe a recomendação de revisão quando necessária. A geração continua registrando a rotina normalmente.

## Validação

- `lowReadinessReducesRoutineVolumeAndPrioritizesMobilityAndTechnique` compara rotinas sem check-in e com prontidão baixa.
- `reviewSignalReducesRoutineAndReturnsAnExplicitRecommendationEvenWithHighScore` verifica que `requiresReview` é respeitado independentemente da pontuação total.
- `generatedRoutineAdjustsToTodaysReadinessAndReturnsReviewRecommendation` cobre o fluxo check-in → geração pela API.
- Testes da tela verificam as mensagens para ajuste e revisão.
