import type { ApiFeedItem } from "../api";
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