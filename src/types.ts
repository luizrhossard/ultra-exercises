export type MuscleKey =
  | "peitoral"
  | "deltoides"
  | "biceps"
  | "triceps"
  | "antebracos"
  | "core"
  | "obliquos"
  | "dorsais"
  | "trapezio"
  | "lombar"
  | "quadriceps"
  | "gluteos"
  | "posteriores"
  | "panturrilhas"
  | "adutores"
  | "abdutores"
  | "flexores";

export type Category =
  | "Força"
  | "Pliometria"
  | "Core"
  | "Condicionamento"
  | "Mobilidade"
  | "Específico";

export interface Sport {
  id: string;
  name: string;
  tag: string;
  color: string;
  demands: string[];
}

export interface SportLink {
  sport: string;
  score: 1 | 2 | 3 | 4 | 5;
  why?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  level: 1 | 2 | 3;
  equipment: string;
  tempo: string;
  muscles: MuscleKey[];
  steps: string[];
  links: SportLink[];
}

export interface UserProfile {
  name: string;
  sports: string[];
  onboarded: boolean;
}

export type Tab = "explorar" | "rotinas" | "perfil";

export const MUSCLE_LABEL: Record<MuscleKey, string> = {
  peitoral: "Peitoral",
  deltoides: "Deltoides",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebracos: "Antebraços",
  core: "Core",
  obliquos: "Oblíquos",
  dorsais: "Dorsais",
  trapezio: "Trapézio",
  lombar: "Lombar",
  quadriceps: "Quadríceps",
  gluteos: "Glúteos",
  posteriores: "Posteriores",
  panturrilhas: "Panturrilhas",
  adutores: "Adutores",
  abdutores: "Abdutores",
  flexores: "Flexores de quadril",
};

export const CATEGORY_ACCENT: Record<Category, string> = {
  "Força": "#d4f53c",
  Pliometria: "#ff8a2a",
  Core: "#ffd23d",
  Condicionamento: "#ff5148",
  Mobilidade: "#38cfe0",
  "Específico": "#b8f04a",
};
