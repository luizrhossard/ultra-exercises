import { describe, it, expect } from "vitest";
import type { ApiFeedItem } from "../api";
import { buildFeedItem, buildFeedItems, categoryFromApi, linksFromApi, rankLocalFeed } from "./feed";
import { EXERCISES } from "./exercises";

const futebolItem: ApiFeedItem = {
  exerciseId: 3,
  name: "Agachamento Búlgaro",
  category: "FORCA",
  equipment: "Halteres + banco",
  muscles: ["quadriceps", "gluteos", "core"],
  bestScore: 5,
  strongCount: 2,
  scoreBySport: { futebol: 5, basquete: 4, corrida: 3 },
  rationaleBySport: { futebol: "Unilateral como o jogo." },
};

describe("categoryFromApi", () => {
  it("mapeia categorias do backend para o tipo local", () => {
    expect(categoryFromApi("FORCA")).toBe("Força");
    expect(categoryFromApi("PLIOMETRIA")).toBe("Pliometria");
    expect(categoryFromApi("CORE")).toBe("Core");
    expect(categoryFromApi("CONDICIONAMENTO")).toBe("Condicionamento");
    expect(categoryFromApi("MOBILIDADE")).toBe("Mobilidade");
    expect(categoryFromApi("ESPECIFICO")).toBe("Específico");
  });

  it("retorna undefined para categoria desconhecida", () => {
    expect(categoryFromApi("ZUMBA")).toBeUndefined();
  });
});

describe("linksFromApi", () => {
  it("converte scoreBySport em links ordenados por relevância", () => {
    const links = linksFromApi(futebolItem);
    expect(links.map((l) => l.sport)).toEqual(["futebol", "basquete", "corrida"]);
    expect(links[0]).toMatchObject({ sport: "futebol", score: 5, why: "Unilateral como o jogo." });
  });

  it("limita o score ao intervalo 1-5", () => {
    const item = { ...futebolItem, scoreBySport: { futebol: 9, boxe: -2 } };
    const links = linksFromApi(item);
    expect(links.find((l) => l.sport === "futebol")?.score).toBe(5);
    expect(links.find((l) => l.sport === "boxe")?.score).toBe(1);
  });
});

describe("buildFeedItem", () => {
  it("herda id/tempo/steps/nível do catálogo local pelo nome (navegação do Player)", () => {
    const ex = buildFeedItem(futebolItem);
    expect(ex.id).toBe("agachamento-bulgaro");
    expect(ex.name).toBe("Agachamento Búlgaro");
    expect(ex.category).toBe("Força");
    expect(ex.tempo).toBe("3-1-1");
    expect(ex.steps.length).toBeGreaterThan(0);
    expect(ex.level).toBe(2);
  });

  it("gera id derivado quando o exercício não existe no catálogo local", () => {
    const ex = buildFeedItem({ ...futebolItem, name: "Exercício Novo", muscles: [] });
    expect(ex.id).toBe("api-3");
    expect(ex.muscles).toEqual([]);
  });

  it("descarta músculos desconhecidos e usa os do catálogo como fallback", () => {
    const ex = buildFeedItem({ ...futebolItem, muscles: ["quadriceps", "panturrilha-inexistente"] });
    expect(ex.muscles).toEqual(["quadriceps"]);
  });
});

describe("buildFeedItems", () => {
  it("preserva a ordem (ranking) vinda da API", () => {
    const a = { ...futebolItem, exerciseId: 1, name: "A" };
    const b = { ...futebolItem, exerciseId: 2, name: "B" };
    expect(buildFeedItems([a, b]).map((e) => e.id)).toEqual(["api-1", "api-2"]);
  });
});

describe("rankLocalFeed", () => {
  it("ranqueia pelo melhor score com desempate alfabético", () => {
    const list = rankLocalFeed(["futebol"]);
    expect(list.length).toBeGreaterThan(0);
    const scores = list.map((e) => Math.max(...e.links.filter((l) => l.sport === "futebol").map((l) => l.score)));
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
  });

  it("retorna vazio sem esportes selecionados", () => {
    expect(rankLocalFeed([])).toEqual([]);
  });

  it("cobre os mesmos 22 exercícios do catálogo", () => {
    expect(EXERCISES).toHaveLength(22);
  });
});