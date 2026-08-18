/**
 * FORJA — seed da base de dados
 *
 * Rodar:  npx prisma db seed   (requer "prisma": { "seed": "tsx prisma/seed.ts" } no package.json)
 *
 * Popula: 8 esportes · 22 exercícios · 92 pares exercise_sport (N:N com relevance 1–5).
 * Idempotente: usa upsert por chaves naturais (code / name).
 */
import { PrismaClient, ExerciseCategory } from "@prisma/client";

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  Esportes                                                           */
/* ------------------------------------------------------------------ */
const SPORTS = [
  { code: "futebol", name: "Futebol", description: "Arrancada, mudança de direção e resistência de jogo" },
  { code: "boxe", name: "Boxe", description: "Potência de golpe, tronco rígido e gás anaeróbio" },
  { code: "jiu-jitsu", name: "Jiu-Jitsu", description: "Pegada, controle de quadril e força isométrica" },
  { code: "basquete", name: "Basquete", description: "Salto vertical, aceleração e aterrissagem" },
  { code: "volei", name: "Vôlei", description: "Impulsão, ombro resistente e defesa lateral" },
  { code: "corrida", name: "Corrida", description: "Economia de passada e blindagem de posteriores" },
  { code: "natacao", name: "Natação", description: "Dorsais potentes, core de rotação e ombro saudável" },
  { code: "tenis", name: "Tênis", description: "Rotação de tronco, pernas elásticas e frenagem" },
] as const;

/* ------------------------------------------------------------------ */
/*  Exercícios + links N:N (relevance_score 1–5 + rationale)           */
/* ------------------------------------------------------------------ */
type Link = { sport: (typeof SPORTS)[number]["code"]; score: number; rationale?: string };
type SeedExercise = {
  name: string;
  category: ExerciseCategory;
  description: string;
  muscleGroups: string[];
  equipmentNeeded: string[];
  links: Link[];
};

const EXERCISES: SeedExercise[] = [
  {
    name: "Agachamento Búlgaro",
    category: ExerciseCategory.FORCA,
    description: "Unilateral de perna que corrige assimetrias e constrói força de empurrão em apoio único.",
    muscleGroups: ["Quadríceps", "Glúteos", "Core"],
    equipmentNeeded: ["Halteres", "Banco"],
    links: [
      { sport: "futebol", score: 5, rationale: "Corrida, chute e mudança de direção acontecem numa perna só — o búlgaro reproduz essa demanda." },
      { sport: "boxe", score: 4, rationale: "A base de guarda é assimétrica; perna de trás forte sustenta o peso e alimenta o golpe." },
      { sport: "jiu-jitsu", score: 3, rationale: "Ajuda nas saídas de quadril e na base de queda unilateral." },
      { sport: "basquete", score: 5, rationale: "Saltos e aterrissagens são unilaterais na maior parte do jogo." },
      { sport: "tenis", score: 4, rationale: "Cada golpe carrega o peso numa perna em flexão — padrão idêntico ao búlgaro." },
      { sport: "corrida", score: 4, rationale: "Fortalece quadríceps e glúteo por perna, reduzindo assimetrias de passada." },
    ],
  },
  {
    name: "Sprint Intervalado 30/30",
    category: ExerciseCategory.CONDICIONAMENTO,
    description: "Tiros curtos com recuperação incompleta para construir potência repetida.",
    muscleGroups: ["Posteriores", "Quadríceps", "Panturrilhas"],
    equipmentNeeded: ["Espaço aberto"],
    links: [
      { sport: "futebol", score: 5, rationale: "Replica o padrão do jogo: aceleração máxima, pausa curta, de novo." },
      { sport: "boxe", score: 5, rationale: "Gás de round se constrói com esforços máximos repetidos." },
      { sport: "basquete", score: 4, rationale: "Transições de quadra inteira com recuperação curta." },
      { sport: "corrida", score: 5, rationale: "Melhora economia de corrida e velocidade de cruzeiro." },
      { sport: "tenis", score: 4, rationale: "Pontos curtos e intensos com pausa — mesma estrutura do 30/30." },
    ],
  },
  {
    name: "Burpee",
    category: ExerciseCategory.CONDICIONAMENTO,
    description: "Corpo inteiro, do chão ao salto, sem equipamento.",
    muscleGroups: ["Peitoral", "Core", "Quadríceps"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "boxe", score: 5, rationale: "Levantar rápido e voltar a golpear é o próprio burpee." },
      { sport: "jiu-jitsu", score: 4, rationale: "Condiciona a transição solo-pé (sprawl) em ritmo de rola." },
      { sport: "futebol", score: 4, rationale: "Prepara para cair, levantar e disputar a bola em sequência." },
      { sport: "basquete", score: 4, rationale: "Resistência de corpo inteiro para o fim do jogo." },
      { sport: "corrida", score: 4, rationale: "Condicionamento anaeróbio sem impacto de passada." },
    ],
  },
  {
    name: "Levantamento Terra",
    category: ExerciseCategory.FORCA,
    description: "O rei da cadeia posterior: quadril, costas e pegada.",
    muscleGroups: ["Posteriores", "Glúteos", "Lombar", "Antebraços"],
    equipmentNeeded: ["Barra", "Anilhas"],
    links: [
      { sport: "jiu-jitsu", score: 5, rationale: "Quadril forte é a base de quedas, raspagens e levantadas com o oponente." },
      { sport: "futebol", score: 4, rationale: "Posterior forte = menos lesão e mais arrancada." },
      { sport: "corrida", score: 3, rationale: "Base de força para a extensão de quadril da passada." },
      { sport: "tenis", score: 4, rationale: "Transfere força do solo para o tronco em cada golpe." },
      { sport: "boxe", score: 3, rationale: "Cadeia posterior sólida sustenta a rotação do golpe." },
    ],
  },
  {
    name: "Prancha com Toque no Ombro",
    category: ExerciseCategory.CORE,
    description: "Anti-rotação com alcance unilateral.",
    muscleGroups: ["Core", "Deltoides"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "futebol", score: 3, rationale: "Estabilidade de tronco no contato ombro a ombro." },
      { sport: "boxe", score: 4, rationale: "Tronco rígido transfere força do chão para o punho." },
      { sport: "jiu-jitsu", score: 4, rationale: "Sustentação de posição quando o adversário empurra." },
      { sport: "corrida", score: 3, rationale: "Core firme evita rotação desperdiçada na passada." },
      { sport: "volei", score: 3, rationale: "Controle de tronco no ataque e na defesa." },
      { sport: "tenis", score: 3, rationale: "Estabiliza o tronco entre as rotações de golpe." },
      { sport: "natacao", score: 4, rationale: "Tronco alinhado reduz arrasto na água." },
    ],
  },
  {
    name: "Flexão Pliométrica",
    category: ExerciseCategory.PLIOMETRIA,
    description: "Empurrão explosivo com saída das mãos do chão.",
    muscleGroups: ["Peitoral", "Tríceps", "Deltoides"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "boxe", score: 5, rationale: "Velocidade de extensão de braço — direta no jab e no direto." },
      { sport: "basquete", score: 4, rationale: "Empurrão reativo para passes e contatos no garrafão." },
      { sport: "volei", score: 3, rationale: "Explosão de membros superiores no bloqueio." },
      { sport: "tenis", score: 3, rationale: "Resposta rápida de braço nas trocas curtas." },
    ],
  },
  {
    name: "Barra Fixa",
    category: ExerciseCategory.FORCA,
    description: "Puxada vertical com o peso do corpo.",
    muscleGroups: ["Dorsais", "Bíceps", "Antebraços"],
    equipmentNeeded: ["Barra fixa"],
    links: [
      { sport: "jiu-jitsu", score: 5, rationale: "Puxada e pegada são o alfabeto do grappling." },
      { sport: "natacao", score: 5, rationale: "Dorsais são o motor da braçada." },
      { sport: "basquete", score: 3, rationale: "Força de puxada para rebotes e contatos." },
      { sport: "tenis", score: 3, rationale: "Costas fortes protegem o ombro no saque." },
    ],
  },
  {
    name: "Desenvolvimento Militar",
    category: ExerciseCategory.FORCA,
    description: "Empurrão vertical de ombros com barra.",
    muscleGroups: ["Deltoides", "Tríceps", "Core"],
    equipmentNeeded: ["Barra", "Anilhas"],
    links: [
      { sport: "boxe", score: 4, rationale: "Ombros que aguentam manter a guarda alta até o último round." },
      { sport: "volei", score: 5, rationale: "Base de força para cortada e saque por cima da cabeça." },
      { sport: "basquete", score: 4, rationale: "Força de ombro para arremesso e rebote alto." },
      { sport: "tenis", score: 3, rationale: "Sustenta o braço no saque e no smash." },
      { sport: "futebol", score: 2 },
    ],
  },
  {
    name: "Salto na Caixa",
    category: ExerciseCategory.PLIOMETRIA,
    description: "Explosão vertical com aterrissagem suave.",
    muscleGroups: ["Quadríceps", "Glúteos", "Panturrilhas"],
    equipmentNeeded: ["Caixa pliométrica"],
    links: [
      { sport: "basquete", score: 5, rationale: "Impulsão vertical direta para rebote e toco." },
      { sport: "volei", score: 5, rationale: "Salto de ataque e bloqueio com aterrissagem segura." },
      { sport: "futebol", score: 4, rationale: "Potência para cabeceio e disputa aérea." },
      { sport: "tenis", score: 4, rationale: "Explosão para subir à rede." },
      { sport: "corrida", score: 3, rationale: "Rigidez reativa que melhora a economia de passada." },
    ],
  },
  {
    name: "Farmer's Carry",
    category: ExerciseCategory.FORCA,
    description: "Caminhada com carga pesada em cada mão.",
    muscleGroups: ["Antebraços", "Trapézio", "Core"],
    equipmentNeeded: ["Halteres pesados"],
    links: [
      { sport: "jiu-jitsu", score: 5, rationale: "Pegada que não abre nem quando o kimono está molhado." },
      { sport: "boxe", score: 3, rationale: "Estabilidade de escápula para o clinche." },
      { sport: "corrida", score: 3, rationale: "Core lateral firme evita queda de quadril na passada." },
    ],
  },
  {
    name: "Remada Curvada",
    category: ExerciseCategory.FORCA,
    description: "Puxada horizontal com barra, tronco inclinado.",
    muscleGroups: ["Dorsais", "Trapézio", "Bíceps"],
    equipmentNeeded: ["Barra", "Anilhas"],
    links: [
      { sport: "jiu-jitsu", score: 4, rationale: "Puxar o adversário para o seu controle." },
      { sport: "boxe", score: 4, rationale: "Costas fortes recolhem o braço mais rápido após o golpe." },
      { sport: "volei", score: 4, rationale: "Equilibra o volume de ombro de quem ataca e saca." },
      { sport: "natacao", score: 4, rationale: "Puxada subaquática mais forte." },
      { sport: "tenis", score: 3, rationale: "Aceleração controlada do braço nos golpes de fundo." },
      { sport: "futebol", score: 3, rationale: "Postura forte para proteger a bola de costas." },
    ],
  },
  {
    name: "Ponte de Quadril",
    category: ExerciseCategory.FORCA,
    description: "Extensão de quadril isolada, deitado no solo.",
    muscleGroups: ["Glúteos", "Posteriores", "Core"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "futebol", score: 5, rationale: "Glúteo ativo é arrancada, proteção e menos lesão de isquiotibial." },
      { sport: "corrida", score: 5, rationale: "Ativa o motor principal da passada: o glúteo." },
      { sport: "volei", score: 3, rationale: "Extensão de quadril no salto de ataque." },
      { sport: "basquete", score: 3, rationale: "Base de salto vertical." },
      { sport: "natacao", score: 3, rationale: "Quadril alto = pernas altas = menos arrasto." },
    ],
  },
  {
    name: "Dead Bug",
    category: ExerciseCategory.CORE,
    description: "Coordenação de membros opostos com lombar colada no chão.",
    muscleGroups: ["Core", "Flexores de quadril"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "futebol", score: 3, rationale: "Padrão de corrida: braço e perna opostos, tronco estável." },
      { sport: "boxe", score: 3, rationale: "Coordenação cruzada que o golpe exige." },
      { sport: "jiu-jitsu", score: 3, rationale: "Controle de quadril quando está de costas." },
      { sport: "corrida", score: 3, rationale: "Estabiliza a pelve a cada passada." },
      { sport: "natacao", score: 3, rationale: "Coordenação de braçada e pernada com eixo estável." },
    ],
  },
  {
    name: "Arrancada de Potência (Power Clean)",
    category: ExerciseCategory.PLIOMETRIA,
    description: "Explosão de tripla extensão com barra.",
    muscleGroups: ["Quadríceps", "Glúteos", "Trapézio"],
    equipmentNeeded: ["Barra olímpica"],
    links: [
      { sport: "futebol", score: 4, rationale: "Transferência máxima de força em velocidade para o sprint." },
      { sport: "basquete", score: 5, rationale: "Potência vertical e de primeiro passo." },
      { sport: "volei", score: 4, rationale: "Salto mais alto com a mesma força." },
      { sport: "tenis", score: 4, rationale: "Explosão de pernas para a troca de direção." },
    ],
  },
  {
    name: "Russian Twist com Peso",
    category: ExerciseCategory.CORE,
    description: "Rotação de tronco resistida, sentado em V.",
    muscleGroups: ["Oblíquos", "Core"],
    equipmentNeeded: ["Anilha ou halter"],
    links: [
      { sport: "boxe", score: 4, rationale: "O golpe nasce na rotação do tronco." },
      { sport: "tenis", score: 4, rationale: "Forehand e backhand são pura rotação resistida." },
      { sport: "jiu-jitsu", score: 3, rationale: "Rotação de escape e reposição no solo." },
      { sport: "volei", score: 3, rationale: "Cortada com torque de tronco." },
      { sport: "futebol", score: 3, rationale: "Giro rápido com a bola dominada." },
    ],
  },
  {
    name: "Prancha de Copenhague",
    category: ExerciseCategory.CORE,
    description: "Prancha lateral com a perna de cima apoiada — blindagem de adutores.",
    muscleGroups: ["Adutores", "Oblíquos", "Core"],
    equipmentNeeded: ["Banco"],
    links: [
      { sport: "futebol", score: 5, rationale: "Adutores blindados = menos virilha lesionada no chute e na mudança de direção." },
      { sport: "tenis", score: 4, rationale: "Freia o corpo nos deslocamentos laterais." },
      { sport: "basquete", score: 3, rationale: "Estabilidade lateral na defesa." },
      { sport: "corrida", score: 3, rationale: "Pelve estável em cada apoio unilateral." },
    ],
  },
  {
    name: "Deslocamento Lateral em Base Baixa",
    category: ExerciseCategory.ESPECIFICO,
    description: "Passos laterais curtos mantendo o quadril baixo.",
    muscleGroups: ["Abdutores", "Glúteos", "Quadríceps", "Core"],
    equipmentNeeded: ["Nenhum"],
    links: [
      { sport: "tenis", score: 5, rationale: "É o padrão exato da defesa de fundo de quadra." },
      { sport: "basquete", score: 4, rationale: "Defesa lateral sem cruzar os pés." },
      { sport: "futebol", score: 4, rationale: "Contenção no 1 contra 1." },
      { sport: "volei", score: 4, rationale: "Bloqueio e defesa exigem deslocamento lateral curto." },
    ],
  },
  {
    name: "Nordic Curl",
    category: ExerciseCategory.FORCA,
    description: "Curl nórdico de isquiotibiais com controle excêntrico.",
    muscleGroups: ["Posteriores", "Glúteos"],
    equipmentNeeded: ["Colchonete", "Parceiro ou ancoragem"],
    links: [
      { sport: "futebol", score: 5, rationale: "O melhor protocolo conhecido contra lesão de isquiotibial no sprint." },
      { sport: "corrida", score: 5, rationale: "Posterior excêntrico forte freia a perna a cada passada." },
      { sport: "basquete", score: 3, rationale: "Protege o posterior nas freadas." },
    ],
  },
  {
    name: "Boxe Sombra com Halteres",
    category: ExerciseCategory.ESPECIFICO,
    description: "Golpes em sequência com carga leve nas mãos.",
    muscleGroups: ["Deltoides", "Tríceps", "Core"],
    equipmentNeeded: ["Halteres leves"],
    links: [
      { sport: "boxe", score: 5, rationale: "Volume de golpe com sobrecarga leve — resistência específica de round." },
    ],
  },
  {
    name: "Levantamento Técnico (Hip Escape Lift)",
    category: ExerciseCategory.ESPECIFICO,
    description: "Da posição de queda, elevar o adversário pelas pernas.",
    muscleGroups: ["Quadríceps", "Glúteos", "Lombar"],
    equipmentNeeded: ["Parceiro de treino"],
    links: [
      { sport: "jiu-jitsu", score: 5, rationale: "Padrão exato da levantada de queda — força específica do gesto." },
    ],
  },
  {
    name: "Rolamento + Sprint",
    category: ExerciseCategory.ESPECIFICO,
    description: "Rolamento de ombro seguido de arrancada máxima.",
    muscleGroups: ["Core", "Quadríceps"],
    equipmentNeeded: ["Colchonete"],
    links: [
      { sport: "jiu-jitsu", score: 4, rationale: "Transição do solo para o movimento — condicionamento específico de rola." },
    ],
  },
  {
    name: "Flow de Mobilidade de Quadril 90/90",
    category: ExerciseCategory.MOBILIDADE,
    description: "Transições controladas entre rotações interna e externa do quadril.",
    muscleGroups: ["Glúteos", "Flexores de quadril"],
    equipmentNeeded: ["Colchonete"],
    links: [
      { sport: "futebol", score: 3, rationale: "Quadril solto muda de direção mais rápido." },
      { sport: "jiu-jitsu", score: 4, rationale: "Mobilidade de quadril é a base das guardas." },
      { sport: "boxe", score: 3, rationale: "Rotação de quadril livre gera mais força no golpe." },
      { sport: "corrida", score: 4, rationale: "Amplitude de passada com menos compensação." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Execução                                                           */
/* ------------------------------------------------------------------ */
async function main() {
  console.log("🔨 FORJA seed — iniciando");

  const sportIds = new Map<string, string>();
  for (const s of SPORTS) {
    const rec = await prisma.sport.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description },
      create: s,
    });
    sportIds.set(s.code, rec.id);
  }
  console.log(`✔ ${SPORTS.length} esportes`);

  let pairCount = 0;
  for (const ex of EXERCISES) {
    const rec = await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {
        description: ex.description,
        category: ex.category,
        muscleGroups: ex.muscleGroups,
        equipmentNeeded: ex.equipmentNeeded,
      },
      create: {
        name: ex.name,
        description: ex.description,
        category: ex.category,
        muscleGroups: ex.muscleGroups,
        equipmentNeeded: ex.equipmentNeeded,
      },
    });

    for (const link of ex.links) {
      const sportId = sportIds.get(link.sport);
      if (!sportId) throw new Error(`Esporte desconhecido: ${link.sport}`);
      await prisma.exerciseSport.upsert({
        where: { exerciseId_sportId: { exerciseId: rec.id, sportId } },
        update: { relevanceScore: link.score, rationale: link.rationale ?? null },
        create: {
          exerciseId: rec.id,
          sportId,
          relevanceScore: link.score,
          rationale: link.rationale ?? null,
        },
      });
      pairCount++;
    }
  }

  console.log(`✔ ${EXERCISES.length} exercícios`);
  console.log(`✔ ${pairCount} pares exercise_sport (relevance 1–5)`);
  console.log("🔥 Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
