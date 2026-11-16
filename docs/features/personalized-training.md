# Personaliza??o das propostas do chat

O planejamento di?rio existente continua em `POST /api/routines/generate`, com esporte e data opcional. Mant?m as pol?ticas de n?vel, disponibilidade, equipamentos, limita??es, prontid?o e preven??o de duplica??o di?ria.

O chat utiliza uma pr?via sem persist?ncia dessas mesmas regras. Dias de descanso ou sinais de revis?o profissional impedem uma proposta de treino. A pr?via consulta adicionalmente sess?es conclu?das dos ?ltimos 42 dias para excluir exerc?cios com dor recente e reduzir s?ries quando indicado. Essa adapta??o n?o aumenta a prescri??o selecionada pelo planejamento atual nem altera suas repeti??es espec?ficas por esporte.

A IA pode retirar exerc?cios ou reduzir s?ries. Antes de salvar, o servidor revalida o contexto. Rotinas confirmadas pelo chat s?o adicionais, sem `plan_date`, para n?o substituir o plano di?rio existente. O resumo `generationSummary` aparece na rotina; `selectionReason` ? retornado nos itens da API autenticada. Esses campos n?o s?o expostos no compartilhamento p?blico.

O Perfil permite editar n?veis por esporte. Salvar prefer?ncias sem informar n?veis preserva os n?veis existentes; novos esportes sem n?vel expl?cito usam RECREATIONAL.

As regras s?o heur?sticas de produto, n?o um modelo cl?nico validado. Relatos na conversa n?o atualizam automaticamente o check-in.
