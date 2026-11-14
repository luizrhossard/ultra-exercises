import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Player from "./Player";
import { api, type ApiExerciseDetail } from "../api";
import { clearCache } from "../cache";
import { EXERCISES } from "../data/exercises";

vi.mock("../api", () => ({ api: { exerciseDetail: vi.fn() } }));

const mocks = vi.hoisted(() => ({
  closePlayer: vi.fn(),
  playerId: { value: "agachamento-bulgaro" as string | null },
  playerName: { value: null as string | null },
  sports: { value: ["futebol"] as string[] },
}));

vi.mock("../store", () => ({
  useApp: () => ({
    playerId: mocks.playerId.value,
    playerName: mocks.playerName.value,
    closePlayer: mocks.closePlayer,
    profile: { name: "T", sports: mocks.sports.value, onboarded: true },
  }),
}));

const apiDetail: ApiExerciseDetail = {
  id: 42,
  name: "Exercício via API",
  category: "PLIOMETRIA",
  equipment: "Caixa",
  muscles: ["quadriceps", "gluteos"],
  steps: ["Aterrisse com controle."],
  links: [{ sportCode: "futebol", sportName: "Futebol", score: 5, rationale: "Potência para arrancadas." }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.playerId.value = "agachamento-bulgaro";
  mocks.playerName.value = null;
  mocks.sports.value = ["futebol"];
  clearCache();
  vi.mocked(api.exerciseDetail).mockReset();
});

describe("Player — modal de detalhe do exercício", () => {
  it("renderiza diálogo com categoria, equipamento e passos", () => {
    render(<Player />);
    expect(screen.getByRole("dialog", { name: "Agachamento Búlgaro" })).toBeInTheDocument();
    expect(screen.getByText("Força")).toBeInTheDocument();
    expect(screen.getByText("Halteres + banco")).toBeInTheDocument();
    expect(
      screen.getByText(/Apoie o peito do pé de trás no banco/)
    ).toBeInTheDocument();
    expect(screen.getByText("Músculos trabalhados")).toBeInTheDocument();
  });

  it("botão voltar chama closePlayer", async () => {
    const user = userEvent.setup();
    render(<Player />);
    await user.click(screen.getByRole("button", { name: "Voltar para o feed" }));
    expect(mocks.closePlayer).toHaveBeenCalledTimes(1);
  });

  it("alterna demonstração entre reproduzir e pausar", async () => {
    const user = userEvent.setup();
    render(<Player />);

    const play = screen.getByRole("button", { name: "Reproduzir demonstração" });
    expect(screen.getByText("00")).toBeInTheDocument();
    expect(screen.getByText("Toque para iniciar o ciclo")).toBeInTheDocument();

    await user.click(play);
    expect(
      screen.getByRole("button", { name: "Pausar demonstração" })
    ).toBeInTheDocument();
    expect(screen.getByText("Ciclo de repetições em andamento")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pausar demonstração" }));
    expect(
      screen.getByRole("button", { name: "Reproduzir demonstração" })
    ).toBeInTheDocument();
  });

  it("lista apenas os mapeamentos dos esportes do perfil, ordenado por score", () => {
    mocks.sports.value = ["futebol", "basquete"];
    render(<Player />);
    // futebol (5) e basquete (5) aparecem; corrida/volei/tenis não
    expect(screen.getByText("Futebol")).toBeInTheDocument();
    expect(screen.getByText("Basquete")).toBeInTheDocument();
    expect(screen.queryByText("Corrida")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Unilateral como o jogo/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Relevância máxima aqui: 5\/5 para/)).toBeInTheDocument();
  });

  it("usa texto padrão quando o link não tem 'why'", () => {
    mocks.sports.value = ["boxe"]; // link boxe score 3 sem 'why'
    render(<Player />);
    expect(
      screen.getByText(/Base de força que sustenta os gestos repetidos/)
    ).toBeInTheDocument();
  });

  it("mostra mensagem de fallback quando nenhum esporte do perfil tem mapeamento", () => {
    mocks.sports.value = ["natacao"];
    render(<Player />);
    expect(
      screen.getByText(/Nenhum dos seus esportes tem mapeamento direto/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Relevância máxima aqui: —/)).toBeInTheDocument();
  });

  it("busca os dados da API e converte para o detalhe do Player", async () => {
    mocks.playerId.value = "api-42";
    vi.mocked(api.exerciseDetail).mockResolvedValue(apiDetail);
    render(<Player />);

    expect(await screen.findByRole("dialog", { name: "Exercício via API" })).toBeInTheDocument();
    expect(api.exerciseDetail).toHaveBeenCalledWith(42);
    expect(screen.getByText("Pliometria")).toBeInTheDocument();
    expect(screen.getByText("Potência para arrancadas.")).toBeInTheDocument();
    expect(screen.getByText("Aterrisse com controle.")).toBeInTheDocument();
  });

  it("reutiliza o detalhe armazenado em cache ao abrir novamente", async () => {
    mocks.playerId.value = "api-42";
    vi.mocked(api.exerciseDetail).mockResolvedValue(apiDetail);
    const first = render(<Player />);
    expect(await screen.findByRole("dialog", { name: "Exercício via API" })).toBeInTheDocument();
    first.unmount();

    render(<Player />);

    expect(await screen.findByRole("dialog", { name: "Exercício via API" })).toBeInTheDocument();
    expect(api.exerciseDetail).toHaveBeenCalledTimes(1);
  });

  it("mostra skeleton dentro do diálogo enquanto a API carrega", () => {
    mocks.playerId.value = "api-42";
    vi.mocked(api.exerciseDetail).mockReturnValue(new Promise(() => {}));
    render(<Player />);

    expect(screen.getByRole("dialog", { name: "Carregando detalhe do exercício" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Carregando detalhe do exercício" })).toHaveAttribute("aria-busy", "true");
  });

  it("usa catálogo local pelo nome se a API falhar", async () => {
    const local = EXERCISES[0];
    mocks.playerId.value = "api-99";
    mocks.playerName.value = local.name;
    vi.mocked(api.exerciseDetail).mockRejectedValue(new Error("offline"));
    render(<Player />);

    expect(await screen.findByRole("dialog", { name: local.name })).toBeInTheDocument();
    expect(screen.getByText(local.steps[0])).toBeInTheDocument();
  });

  it("permite tentar novamente quando não há detalhe local compatível", async () => {
    const user = userEvent.setup();
    mocks.playerId.value = "api-404";
    mocks.playerName.value = "Exercício fora do catálogo";
    vi.mocked(api.exerciseDetail).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(apiDetail);
    render(<Player />);

    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("dialog", { name: "Exercício via API" })).toBeInTheDocument();
    expect(api.exerciseDetail).toHaveBeenCalledTimes(2);
  });

  it("não renderiza nada sem exercício selecionado", () => {
    mocks.playerId.value = null;
    const { container } = render(<Player />);
    expect(container).toBeEmptyDOMElement();
  });
});
