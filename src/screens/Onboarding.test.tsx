import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Onboarding from "./Onboarding";
import { SPORTS } from "../data/sports";

const mocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../store", () => ({
  useApp: () => mocks,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Onboarding — escolha de esportes e perfil", () => {
  it("inicia sem seleção e com CTA desabilitado", () => {
    render(<Onboarding />);
    expect(screen.getByText("0 selecionados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar na arena/ })).toBeDisabled();
    // catálogo de esportes renderizado (aparece no painel desktop e no ticker)
    expect(screen.getAllByText(SPORTS[0].name).length).toBeGreaterThan(0);
  });

  it("seleciona e desseleiona um esporte atualizando contador e CTA", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const first = screen.getByRole("button", { name: new RegExp(SPORTS[0].name) });
    await user.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar na arena/ })).toBeEnabled();

    await user.click(first);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0 selecionados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar na arena/ })).toBeDisabled();
  });

  it("envia nome aparado e esportes selecionados", async () => {
    const user = userEvent.setup();
    mocks.completeOnboarding.mockResolvedValue(undefined);
    render(<Onboarding />);

    await user.click(screen.getByRole("button", { name: new RegExp(SPORTS[0].name) }));
    await user.click(screen.getByRole("button", { name: new RegExp(SPORTS[1].name) }));
    await user.type(screen.getByPlaceholderText("Seu nome ou apelido"), "  Léo  ");
    await user.click(screen.getByRole("button", { name: /Entrar na arena/ }));

    expect(mocks.completeOnboarding).toHaveBeenCalledWith("Léo", [SPORTS[0].id, SPORTS[1].id]);
  });

  it("exibe toast de falha quando salvar o perfil dá erro", async () => {
    const user = userEvent.setup();
    mocks.completeOnboarding.mockRejectedValue(new Error("offline"));
    render(<Onboarding />);

    await user.click(screen.getByRole("button", { name: new RegExp(SPORTS[0].name) }));
    await user.click(screen.getByRole("button", { name: /Entrar na arena/ }));

    await expect(mocks.toast).toHaveBeenCalledWith("Não foi possível salvar seu perfil.");
  });
});
