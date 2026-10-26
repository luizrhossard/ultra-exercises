import type { ApiExerciseDetail, ApiFeedItem } from "../api";
import { EXERCISES, rankFor } from "./exercises";
import { MUSCLE_LABEL } from "../types";
import type { Category, Exercise, MuscleKey, SportLink } from "../types";

const API_CATEGORY: Record<ApiFeedItem["category"], Category> = {
  FORCA: "Força",
  PLIOMETRIA: "Pliometria",
  CORE: "Core",
  CONDICIONAMENTO: "Condicionamento",
  MOBILIDADE: "Mobilidade",
  ESPECIFICO: "Específico",
};

export function categoryFromApi(value: string): Category | undefined {
  return API_CATEGORY[value as ApiFeedItem["category"]];
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

export function exerciseByName(name: string | null | undefined): Exercise | undefined {
  if (!name) return undefined;
  const normalized = normalizeName(name);
  return EXERCISES.find((exercise) => normalizeName(exercise.name) === normalized);
}

export function difficultyToLevel(value: string | null | undefined, fallback: Exercise["level"] = 2): Exercise["level"] {
  const normalized = normalizeName(value ?? "");
  if (["iniciante", "beginner", "basico"].includes(normalized)) return 1;
  if (["avancado", "advanced", "profissional"].includes(normalized)) return 3;
  if (["intermediario", "intermediate"].includes(normalized)) return 2;
  return fallback;
}

export function buildExerciseDetail(item: ApiExerciseDetail, requestedName?: string | null): Exercise {
  const local = exerciseByName(item.name) ?? exerciseByName(requestedName);
  const muscleKeys = Object.keys(MUSCLE_LABEL) as MuscleKey[];
  const muscles = item.muscles.flatMap((value) => {
    if (muscleKeys.includes(value as MuscleKey)) return [value as MuscleKey];
    const normalized = normalizeName(value);
    const match = muscleKeys.find((key) => normalizeName(MUSCLE_LABEL[key]) === normalized);
    return match ? [match] : [];
  });
  return {
    id: `api-${item.id}`,
    name: item.name || local?.name || requestedName || `ExercÃ­cio ${item.id}`,
    category: categoryFromApi(item.category) ?? local?.category ?? API_CATEGORY.FORCA,
    level: difficultyToLevel(item.difficulty, local?.level ?? 2),
    equipment: item.equipment ?? local?.equipment ?? "NÃ£o informado",
    tempo: local?.tempo ?? "NÃ£o informado",
    muscles: muscles.length ? [...new Set(muscles)] : (local?.muscles ?? []),
    steps: item.steps.length ? item.steps : (local?.steps ?? []),
    links: item.links.map((link) => ({
      sport: link.sportCode,
      score: Math.min(5, Math.max(1, link.score)) as SportLink["score"],
      why: link.rationale ?? undefined,
    })).sort((a, b) => b.score - a.score),
  };
}

/** Converte scoreBySport/rationaleBySport da API na lista de links local, ordenada por relevância. */
export function linksFromApi(item: ApiFeedItem): SportLink[] {
  return Object.entries(item.scoreBySport)
    .map(([sport, score]) => ({
      sport,
      score: Math.min(5, Math.max(1, score)) as SportLink["score"],
      why: item.rationaleBySport[sport],
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Converte um item do feed da API no formato local. O ranking vem do backend
 * (melhor score + desempates); id/tempo/steps/nível são herdados do catálogo
 * local (merge por nome) para a navegação do Player continuar funcionando.
 */
export function buildFeedItem(item: ApiFeedItem): Exercise {
  const local = EXERCISES.find((e) => e.name === item.name);
  const muscles = item.muscles.filter((m): m is MuscleKey => m in MUSCLE_LABEL);
  return {
    id: local?.id ?? `api-${item.exerciseId}`,
    name: item.name,
    category: categoryFromApi(item.category) ?? "Força",
    level: local?.level ?? 2,
    equipment: item.equipment ?? local?.equipment ?? "",
    tempo: local?.tempo ?? "",
    muscles: muscles.length > 0 ? muscles : (local?.muscles ?? []),
    steps: local?.steps ?? [],
    links: linksFromApi(item),
  };
}

export function buildFeedItems(items: ApiFeedItem[]): Exercise[] {
  return items.map(buildFeedItem);
}

/**
 * Fallback local quando a API está indisponível: catálogo estático ranqueado
 * pela regra do cliente (melhor score × 10 + nº de esportes com score >= 4).
 */
export function rankLocalFeed(userSports: string[]): Exercise[] {
  return EXERCISES.filter((ex) => rankFor(ex, userSports) > 0)
    .sort((a, b) => rankFor(b, userSports) - rankFor(a, userSports) || a.name.localeCompare(b.name));
}
