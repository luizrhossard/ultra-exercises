import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Profile from "./Profile";
import { SPORTS } from "../data/sports";

const mocks = vi.hoisted(() => ({
  profile: { name: "leo", sports: ["futebol"], onboarded: true },
  setName: vi.fn(),
  toggleSport: vi.fn(),
  resetAll: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../store", () => ({
  useApp: () => ({
    profile: mocks.profile,
    setName: mocks.setName,
    toggleSport: mocks.toggleSport,
    resetAll: mocks.resetAll,
    toast: mocks.toast,
  }),
}));

vi.mock("../components/TwoFactorSettings", () => ({
  default: () => <div data-testid="twofa-stub" />,
}));

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    todayReadiness: vi.fn().mockResolvedValue(null),
    saveReadiness: vi.fn(),
    twoFactorStatus: vi.fn().mockResolvedValue({ enabled: false }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Profile — identidade, esportes e zona de risco", () => {
  it("renderiza perfil com iniciais e estatísticas da base", () => {
    render(<Profile />);
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument(); // inicial do nome
    expect(screen.getByText("Exercícios na base")).toBeInTheDocument();
    expect(screen.getByText("Esportes ativos")).toBeInTheDocument();
    expect(screen.getByTestId("twofa-stub")).toBeInTheDocument();
  });

  it("salva o nome aparado e exibe confirmação", async () => {
    const user = userEvent.setup();
    render(<Profile />);

    const input = screen.getByPlaceholderText("Seu nome");
    await user.clear(input);
    await user.type(input, "  Leonardo  ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mocks.setName).toHaveBeenCalledWith("Leonardo");
    expect(mocks.toast).toHaveBeenCalledWith("Nome atualizado");
  });

  it("liga e desliga esportes com toasts distintos", async () => {
    const user = userEvent.setup();
    render(<Profile />);

    const basquete = screen.getByRole("button", { name: new RegExp(SPORTS.find((s) => s.id === "basquete")!.name) });
    await user.click(basquete);
    expect(mocks.toggleSport).toHaveBeenCalledWith("basquete");
    expect(mocks.toast).toHaveBeenCalledWith(
      `${SPORTS.find((s) => s.id === "basquete")!.name} adicionado ao foco`,
      SPORTS.find((s) => s.id === "basquete")!.color
    );

    const futebol = screen.getByRole("button", { name: new RegExp("Futebol") });
    await user.click(futebol);
    expect(mocks.toggleSport).toHaveBeenCalledWith("futebol");
    expect(mocks.toast).toHaveBeenCalledWith("Futebol removido do foco", undefined);
  });

  it("exige confirmação antes de resetar o app", async () => {
    const user = userEvent.setup();
    render(<Profile />);

    await user.click(screen.getByRole("button", { name: /Resetar app/ }));
    expect(screen.getByRole("button", { name: "Confirmar reset" })).toBeInTheDocument();

    // Cancelar volta ao estado inicial sem resetar
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Confirmar reset" })).not.toBeInTheDocument();
    expect(mocks.resetAll).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Resetar app/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar reset" }));
    expect(mocks.resetAll).toHaveBeenCalledTimes(1);
  });

  it("explica como a relevância funciona", () => {
    render(<Profile />);
    expect(screen.getByText("Como a relevância funciona")).toBeInTheDocument();
    expect(screen.getByText(/relevance_score de 1 a 5/)).toBeInTheDocument();
  });
});
