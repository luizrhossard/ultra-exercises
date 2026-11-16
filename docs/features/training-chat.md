# Assistente de treino com OpenRouter

Na tela Rotinas, selecione um esporte e use **Planejar com IA**. Revise a proposta antes de salvar. A geração tradicional continua disponível se a IA falhar.

## Configuração

Defina no ambiente do processo Java (nunca em variáveis VITE ou no repositório):

- `OPENROUTER_API_KEY`: chave criada no OpenRouter.
- `OPENROUTER_MODEL`: identificador do modelo; padrão `baidu/ernie-5.5-flash-preview:free`. Para comportamento mais consistente, configure um modelo gratuito específico disponível na sua conta.

Reinicie o backend após configurar. Uma chave ausente não impede a aplicação de iniciar. A interface informa que o assistente não está configurado quando houver uma tentativa de conversa. Não é necessário instalar um modelo local.

## Contrato e limites

- `POST /api/training-chat`: JWT, `{ sportId, messages: [{role: "user" | "assistant", content}] }`.
- Resposta: `{ message, proposalId, items }`. Sem proposta, `proposalId` é nulo.
- `POST /api/training-chat/save`: JWT, `{ proposalId }`; retorna `{ id }`.
- Até 20 mensagens de 2.000 caracteres, duas chamadas simultâneas por instância, timeout de 40 segundos no provedor. Limite autenticado existente também se aplica.
- Propostas em memória, vinculadas ao usuário, válidas por 15 minutos e de uso único. Reinícios as invalidam; múltiplas instâncias exigem armazenamento compartilhado antes de escalar.
- Conversas ficam apenas no estado da tela. O servidor transmite a conversa e o catálogo selecionado, sem adicionar e-mail, nome ou registros brutos do usuário. Texto digitado pode conter dados pessoais; a interface informa o envio externo. Confira as políticas do modelo/provedor escolhido.
- A IA só pode retirar exercícios e reduzir séries da seleção produzida pelo gerador. IDs, séries, duplicações e formato são validados. Ao salvar, o sistema reavalia elegibilidade e prescrição pelo contexto atual.
- Esta versão não busca exercícios alternativos fora da seleção, não calcula duração exata e não converte relatos livres em check-in. O usuário deve registrar dores e prontidão no Perfil; instruções no prompt não substituem validações clínicas.
- Respostas inválidas, falta de capacidade, limite do provedor e indisponibilidade não salvam rotinas. Não há troca automática para modelos pagos.

API utilizada: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request

## Verificação

`npm run typecheck`, `npm run lint`, `npx vitest run src/components/TrainingChat.test.tsx`.

No diretório backend: `mvn -q "-Dtest=TrainingChatServiceTest,RoutineGeneratorServiceTest,RoutineControllerTest" test`.

Os testes simulam o provedor. Para teste real, configure uma chave, envie uma conversa, confira a proposta e salve; depois confirme a rotina na lista. Não grave a chave ou a conversa em logs.
