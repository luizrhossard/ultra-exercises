# Catálogo de Vôlei [UE-52]

Epic: UE-48. Dados em `backend/src/main/resources/seed/data.json`.
Testes: `backend/src/test/java/com/forja/web/VoleiCatalogIntegrationTest.java`.

## Cobertura

| Critério | Meta | Atual |
|---|---|---|
| Exercícios `ESPECIFICO` vinculados ao Vôlei | ≥ 5 | 7 |
| Aterrissagem | presente | Aterrissagem Silenciosa de Salto (relevância 5) |
| Ataque | presente | Passada de Aproximação de Ataque (relevância 5) |
| Bloqueio (deslocamento, impulsão, combinação) | presente | Deslocamento Lateral com Salto de Bloqueio (5), Impulsão Vertical com Alcance de Bloqueio (5) |
| Saúde do ombro de ataque | ≥ 2 | Elevação em Y-T-W (5), Rotação Externa (4), Rotação Interna (3) |
| Pliometria reativa | presente | Saltos Reativos de Contato Curto (4) |
| Vínculos com Vôlei | — | 23 |

## Exercícios novos (UE-52)

| Exercício | Categoria | Dificuldade | Relevância Vôlei | Estímulo |
|---|---|---|---|---|
| Aterrissagem Silenciosa de Salto | ESPECIFICO | INICIANTE | 5 | Técnica de aterrissagem, joelho alinhado |
| Passada de Aproximação de Ataque | ESPECIFICO | INTERMEDIARIO | 5 | Padrão de três passos e impulsão do ataque |
| Deslocamento Lateral com Salto de Bloqueio | ESPECIFICO | INTERMEDIARIO | 5 | Combinação deslocamento + salto |
| Impulsão Vertical com Alcance de Bloqueio | PLIOMETRIA | INTERMEDIARIO | 5 | Impulsão vertical e alcance no bloqueio |
| Elevação em Y-T-W com Elástico | ESPECIFICO | INICIANTE | 5 | Prevenção do ombro de ataque (escápula) |
| Saltos Reativos de Contato Curto | PLIOMETRIA | INTERMEDIARIO | 4 | Reatividade de tornozelo e perna |

Os exercícios de ombro da UE-51 (rotações externa e interna) também são vinculados ao Vôlei
(relevância 4 e 3), como prevenção do manguito no ombro dominante.

## Observações

- Impulsão e reatividade foram classificadas como PLIOMETRIA para que o gerador continue
  equilibrando as cotas por categoria. Os demais estímulos específicos são ESPECIFICO.
- Vôlei não recebe AVANCADO nos exercícios novos. O único AVANCADO vinculado ao esporte
  (Cadeira Nórdica) já existia.
- Como em Natação, o seeder é incremental: bases existentes recebem os exercícios novos.
