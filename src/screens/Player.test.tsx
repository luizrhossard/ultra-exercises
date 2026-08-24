import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Player from "./Player";

const mocks = vi.hoisted(() => ({
  closePlayer: vi.fn(),
  playerId: { value: "agachamento-bulgaro" as string | null },
  sports: { value: ["futebol"] as string[] },
}));

vi.mock("../store", () => ({
  useApp: () => ({
    playerId: mocks.playerId.value,
    closePlayer: mocks.closePlayer,
    profile: { name: "T", sports: mocks.sports.value, onboarded: true },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.playerId.value = "agachamento-bulgaro";
  mocks.sports.value = ["futebol"];
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

  it("não renderiza nada sem exercício selecionado", () => {
    mocks.playerId.value = null;
    const { container } = render(<Player />);
    expect(container).toBeEmptyDOMElement();
  });
});
