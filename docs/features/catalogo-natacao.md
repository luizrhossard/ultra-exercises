# Catálogo de Natação [UE-51]

Epic: UE-48. Dados em `backend/src/main/resources/seed/data.json`.
Testes: `backend/src/test/java/com/forja/web/NatacaoCatalogIntegrationTest.java`.

## Cobertura

| Critério | Meta | Atual |
|---|---|---|
| Exercícios vinculados à Natação | ≥ 12 | 16 |
| Exercícios `ESPECIFICO` | ≥ 5 | 5 |
| Prevenção do ombro de nadador (manguito) | ≥ 2 | 2 (rotação externa e interna com elástico) |

## Exercícios novos (UE-51)

| Exercício | Categoria | Dificuldade | Relevância | Estímulo |
|---|---|---|---|---|
| Rotação Externa de Ombro com Elástico | ESPECIFICO | INICIANTE | 5 | Prevenção: manguito, equilibra a rotação interna da braçada |
| Rotação Interna de Ombro com Elástico | ESPECIFICO | INICIANTE | 4 | Prevenção: subescapular e controle da entrada da mão |
| Puxada de Braçada com Elástico | ESPECIFICO | INTERMEDIARIO | 5 | Padrão de braçada com resistência (stretch cord) |
| Nado com Paraquedas de Resistência | ESPECIFICO | INTERMEDIARIO | 5 | Nado com resistência na piscina |
| Nado com Pull Buoy e Palmar | ESPECIFICO | INTERMEDIARIO | 5 | Força específica de braçada |
| Prancha Streamline com Rotação | CORE | INTERMEDIARIO | 5 | Core de rotação e estabilidade |
| Mobilidade de Ombro com Bastão | MOBILIDADE | INICIANTE | 5 | Amplitude de ombro |
| Mobilidade de Tornozelo em Flexão Plantar | MOBILIDADE | INICIANTE | 4 | Flexão plantar para a pernada |

Vínculos existentes que já atendiam Natação (por exemplo, Barra Fixa, Remada Curvada,
Levantamento Terra) permanecem como estavam.

## Regras de catálogo aplicadas

- Cada exercício tem categoria, dificuldade, equipamento, músculos, passos e pelo menos
  um vínculo com justificativa (`rationale`).
- Exercícios de ombro têm relevância 4–5 em Natação; em Vôlei e Tênis aparecem com nota menor,
  porque o mesmo cuidado com o manguito também serve a esses esportes.
- A Natação só recebe dificuldade AVANCADO por exercícios já existentes. Nenhum dos novos
  exercícios é AVANCADO, pois são estímulos de base e prevenção.

## Carga do seed (DataSeeder)

O seeder é incremental: insere apenas esportes e exercícios que ainda não existem (buscados
por `code` e `name`). Bases já populadas recebem os exercícios novos sem duplicação.
