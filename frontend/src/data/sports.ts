import type { Sport } from "../types";

export const SPORTS: Sport[] = [
  {
    id: "futebol",
    name: "Futebol",
    tag: "Arrancada, mudança de direção e resistência de jogo",
    color: "#34d97b",
    demands: ["Sprints repetidos", "Unilateral de pernas", "Prevenção de isquiotibiais"],
  },
  {
    id: "boxe",
    name: "Boxe",
    tag: "Potência de golpe, tronco rígido e gás anaeróbio",
    color: "#ff5148",
    demands: ["Rotação explosiva", "Ombros que aguentam rounds", "Core de transferência"],
  },
  {
    id: "jiu-jitsu",
    name: "Jiu-Jitsu",
    tag: "Pegada, controle de quadril e força isométrica",
    color: "#5b8cff",
    demands: ["Puxada e pegada", "Quadril dominante", "Força em ângulos estranhos"],
  },
  {
    id: "basquete",
    name: "Basquete",
    tag: "Salto vertical, aceleração e aterrissagem",
    color: "#ff8a2a",
    demands: ["Impulsão reativa", "Absorção de impacto", "Troca de direção"],
  },
  {
    id: "volei",
    name: "Vôlei",
    tag: "Impulsão, ombro resistente e defesa lateral",
    color: "#ffd23d",
    demands: ["Salto repetido", "Manguito blindado", "Reação lateral"],
  },
  {
    id: "corrida",
    name: "Corrida",
    tag: "Economia de passada e blindagem de posteriores",
    color: "#ff6fb2",
    demands: ["Posterior de ferro", "Rigidez de panturrilha", "Estabilidade de quadril"],
  },
  {
    id: "natacao",
    name: "Natação",
    tag: "Dorsais potentes, core de rotação e ombro saudável",
    color: "#38cfe0",
    demands: ["Puxada subaquática", "Rotação de tronco", "Estabilidade escapular"],
  },
  {
    id: "tenis",
    name: "Tênis",
    tag: "Rotação de tronco, pernas elásticas e frenagem",
    color: "#b8f04a",
    demands: ["Frenagem excêntrica", "Cadeia rotacional", "Passada lateral"],
  },
];

export const sportById = (id: string): Sport =>
  SPORTS.find((s) => s.id === id) ?? SPORTS[0];
