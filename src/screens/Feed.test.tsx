import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Feed from "./Feed";

const mocks = vi.hoisted(() => ({
  openPlayer: vi.fn(),
  setTab: vi.fn(),
}));

vi.mock("../store", () => ({
  useApp: () => ({
    profile: { name: "leo", sports: ["futebol"], onboarded: true },
    token: "tok-feed",
    openPlayer: mocks.openPlayer,
    setTab: mocks.setTab,
  }),
}));

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    sports: vi.fn(),
    exercisesFeed: vi.fn(),
  },
}));

import { api } from "../api";
import { clearCache } from "../cache";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearCache(); // o espelho em memória do cache sobrevive ao localStorage.clear()
  vi.mocked(api.sports).mockResolvedValue([
    { id: 1, code: "futebol", name: "Futebol", description: null },
  ]);
  // Padrão: backend indisponível → feed local ranqueado entra no lugar.
  vi.mocked(api.exercisesFeed).mockRejectedValue(new Error("offline"));
});

describe("Feed — exploração de exercícios", () => {
  it("renderiza feed local ranqueado quando o backend falha", async () => {
    render(<Feed />);
    expect(screen.getByText("Explorar")).toBeInTheDocument();
    expect(await screen.findByText("Agachamento Búlgaro")).toBeInTheDocument();
    expect(
      await screen.findByText(/exercícios ordenados por/, { selector: "p" })
    ).toBeInTheDocument();
    expect(screen.getByText(/esportes mapeados · relação N:N/)).toBeInTheDocument();
  });

  it("renderiza itens do feed do backend quando disponíveis", async () => {
    vi.mocked(api.exercisesFeed).mockResolvedValue([
      {
        exerciseId: 999,
        name: "Exercício Remoto",
        category: "CORE",
        equipment: "Barra",
        muscles: ["core"],
        bestScore: 5,
        strongCount: 2,
        scoreBySport: { futebol: 5 },
        rationaleBySport: { futebol: "Transferência direta." },
      },
    ]);
    render(<Feed />);
    expect(await screen.findByText("Exercício Remoto")).toBeInTheDocument();
    expect(api.exercisesFeed).toHaveBeenCalledWith([1]);
  });

  it("abre o player ao clicar em um exercício", async () => {
    render(<Feed />);
    const card = await screen.findByText("Agachamento Búlgaro");
    await userEvent.click(card);
    expect(mocks.openPlayer).toHaveBeenCalledWith("agachamento-bulgaro");
  });

  it("filtra pela busca e exibe estado vazio", async () => {
    const user = userEvent.setup();
    render(<Feed />);
    await screen.findByText("Agachamento Búlgaro");

    await user.type(screen.getByPlaceholderText(/Buscar exercício/), "agachamento");
    await waitFor(() =>
      expect(screen.queryByText("Salto na Caixa")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Agachamento Búlgaro")).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/Buscar exercício/));
    await user.type(screen.getByPlaceholderText(/Buscar exercício/), "zzznada");
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("filtra por categoria", async () => {
    const user = userEvent.setup();
    render(<Feed />);
    await screen.findByText("Agachamento Búlgaro");

    await user.click(screen.getByRole("button", { name: "Pliometria" }));
    await waitFor(() =>
      expect(screen.queryByText("Agachamento Búlgaro")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Salto na Caixa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todas" }));
    expect(await screen.findByText("Agachamento Búlgaro")).toBeInTheDocument();
  });

  it("vai para o perfil pelo botão do avatar", async () => {
    const user = userEvent.setup();
    render(<Feed />);
    await screen.findByText("Explorar");
    await user.click(screen.getByRole("button", { name: "Abrir perfil" }));
    expect(mocks.setTab).toHaveBeenCalledWith("perfil");
  });

  it("pagina com Carregar mais até o fim da lista", async () => {
    const user = userEvent.setup();
    render(<Feed />);
    await screen.findByText("Agachamento Búlgaro");

    const loadMore = screen.getByRole("button", { name: "Carregar mais" });
    await user.click(loadMore);

    await waitFor(
      () => expect(screen.getByText("Você chegou ao fim da lista")).toBeInTheDocument(),
      { timeout: 3000 }
    );
    expect(
      screen.queryByRole("button", { name: "Carregar mais" })
    ).not.toBeInTheDocument();
  });
});
