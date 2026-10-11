# UE-57 — Drills de corrida e progressão de volume

## Exercícios específicos incluídos

- **Skip A — Técnica de Passada:** coordenação de braços e pernas, postura e apoio sob o quadril.
- **Dribbling de Corrida:** contatos curtos e rápidos com baixa amplitude.
- **Pogos Bilaterais de Baixa Amplitude:** introdução de pliometria específica com poucos contatos.

Os três estão classificados como `ESPECIFICO`, ligados ao esporte `corrida` e com dificuldade inicial `INICIANTE`. A prescrição de pogos deve manter baixa altura e contatos controlados.

## Progressão por nível de corrida

O gerador usa o `SportLevel` cadastrado para Corrida e prescreve o volume por sessão. Skip A e dribbling usam distância; pogos usam contatos.

| Nível cadastrado | Skip A | Dribbling | Pogos baixos | Descanso entre séries |
| --- | --- | --- | --- | --- |
| `RECREATIONAL` — base/iniciante | 2 × 10 m | 2 × 10 m | 2 × 8 contatos | 90 s |
| `AMATEUR` | 3 × 12 m | 3 × 12 m | 3 × 10 contatos | 75 s |
| `COMPETITIVE` | 3 × 15 m | 3 × 15 m | 3 × 12 contatos | 60 s |
| `PROFESSIONAL` | 4 × 20 m | 4 × 20 m | 4 × 15 contatos | 60 s |

A rotina gerada exibe séries, distância/contatos e descanso. Avançar para o próximo nível somente quando coordenação, aterrissagem leve e postura forem mantidas em todas as séries. Não exceder a dose prescrita; nos pogos, manter a baixa altura e deixar pelo menos 48 h entre sessões pliométricas.

Esta progressão dosa os drills, não altera automaticamente a quilometragem semanal da corrida. A seleção de exercícios continua respeitando a cota de um exercício específico por rotina.

## Validação

- `runningTechniqueVolumeProgressesByAthleteSportLevel` verifica séries, distância/contatos e descanso nos quatro níveis.
- `ue57_runningTechniqueDrillsAreSpecificAndLinkedToRunning` verifica categoria e vínculo no contrato da API.
- Teste de catálogo frontend garante pelo menos três exercícios `Específico` vinculados a `corrida`.
