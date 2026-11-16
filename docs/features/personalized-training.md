# Geração personalizada de treinos

O endpoint `POST /api/routines/generate` mantém o contrato de entrada `{ sportId }`.
A seleção e a prescrição são calculadas no backend, com dados do usuário autenticado.

- Consulta sessões **concluídas nos últimos 42 dias**, ordenadas pela conclusão; itens sem séries realizadas não contam como execução.
- Usa a relevância para o esporte foco e o nível informado em Perfil. Exercícios avançados não entram no nível recreativo.
- Reduz a prioridade de exercícios e músculos trabalhados nas últimas 48 horas, mantendo a relevância e o equilíbrio de categorias.
- Exclui exercícios com qualquer dor registrada nos últimos 14 dias, inclusive se não houve séries realizadas.
- Usa somente o check-in de hoje. Sem check-in, informa que a condição atual é desconhecida; sem histórico, usa a base por nível sem inventar progressão.
- Sono baixo, fadiga, estresse, desconforto muscular, dor ou sessão recente com esforço alto reduzem o volume. Nessa situação, remove pliometria e prioriza mobilidade na composição de até cinco exercícios.
- Dor a partir de 5 no check-in impede a geração e retorna uma mensagem para revisão profissional.
- Esforço alto ou séries incompletas reduzem séries e aumentam descanso na próxima execução.
- Progressão exige duas execuções completas com repetições correspondentes à prescrição, esforço registrado até 7, dor explicitamente zero e cargas comparáveis. Em força, cargas ausentes impedem progressão. O aumento fica limitado a uma série acima da base por nível, com teto de cinco séries.

As janelas e limiares são regras de produto explícitas, não um modelo clínico validado.
O motor não interpreta texto livre como diagnóstico, não aumenta cargas automaticamente e não utiliza um LLM.
Não faz inferências sobre equipamento disponível, objetivos ou restrições descritas apenas em texto.
As repetições permanecem nos presets de categoria; a adaptação atual atua na seleção, séries e descanso.

`generationSummary` é persistido na rotina e `selectionReason` em cada item. A listagem autenticada retorna esses campos e a interface os mostra ao expandir a rotina. Rotinas antigas continuam válidas sem explicação retroativa.
Esses campos não são adicionados ao compartilhamento público, evitando expor informações pessoais de recuperação.

As migrações V6 e V7 foram recuperadas do histórico original para compatibilidade com os bancos já existentes; V8 adiciona apenas os campos de explicação. Nenhuma conta ou sessão é removida.
