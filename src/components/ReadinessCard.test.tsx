import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReadinessCard from "./ReadinessCard";

const mocks = vi.hoisted(() => ({
  token: { value: "tok-readiness" },
  toast: vi.fn(),
}));

vi.mock("../store", () => ({
  useApp: () => ({ token: mocks.token.value, toast: mocks.toast }),
}));

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    todayReadiness: vi.fn(),
    saveReadiness: vi.fn(),
  },
}));

import { api } from "../api";
import { clearCache } from "../cache";

beforeEach(() => {
  vi.clearAllMocks();
  clearCache();
  localStorage.clear();
});

function sliderOf(group: string) {
  const label = screen.getByText(group).closest("label");
  if (!label) throw new Error(`label não encontrado: ${group}`);
  return label.querySelector('input[type="range"]') as HTMLInputElement;
}

describe("ReadinessCard — check-in de prontidão", () => {
  it("renderiza formulário com valores padrão e sem score", () => {
    vi.mocked(api.todayReadiness).mockResolvedValue(null);
    render(<ReadinessCard />);
    expect(screen.getByText("Check-in de prontidão")).toBeInTheDocument();
    expect(screen.queryByText(/\/30/)).not.toBeInTheDocument();
    expect(screen.getAllByText("3/5")).toHaveLength(4); // valor inicial dos sliders
    expect(screen.getByRole("button", { name: "Salvar prontidão" })).toBeEnabled();
  });

  it("sincroniza dados remotos e exibe sinal de atenção quando requer revisão", async () => {
    vi.mocked(api.todayReadiness).mockResolvedValue({
      date: "2026-08-24",
      sleepQuality: 5,
      fatigue: 1,
      stress: 2,
      soreness: 4,
      painArea: "joelho",
      painLevel: 3,
      notes: null,
      readinessScore: 27,
      requiresReview: true,
    });
    render(<ReadinessCard />);

    await waitFor(() => expect(screen.getByText("27/30")).toBeInTheDocument());
    expect(
      screen.getByText(/Sinal de atenção/)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("joelho")).toBeInTheDocument();
  });

  it("salva o check-in com os valores do formulário", async () => {
    const user = userEvent.setup();
    vi.mocked(api.todayReadiness).mockResolvedValue(null);
    vi.mocked(api.saveReadiness).mockResolvedValue({
      date: "2026-08-24",
      sleepQuality: 5,
      fatigue: 3,
      stress: 3,
      soreness: 3,
      painArea: "",
      painLevel: 0,
      notes: "",
      readinessScore: 24,
      requiresReview: false,
    });
    render(<ReadinessCard />);
    await waitFor(() => expect(api.todayReadiness).toHaveBeenCalled());

    fireEvent.change(sliderOf("Sono"), { target: { value: "5" } });
    await user.type(screen.getByPlaceholderText("Local de dor (opcional)"), "tornozelo");
    await user.click(screen.getByRole("button", { name: "Salvar prontidão" }));

    await waitFor(() =>
      expect(api.saveReadiness).toHaveBeenCalledWith(
        "tok-readiness",
        expect.objectContaining({ sleepQuality: 5, painArea: "tornozelo" })
      )
    );
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Prontidão salva."));
    expect(screen.getByText("24/30")).toBeInTheDocument();
  });

  it("avisa sobre revisão quando o score salvo exige atenção", async () => {
    const user = userEvent.setup();
    vi.mocked(api.todayReadiness).mockResolvedValue(null);
    vi.mocked(api.saveReadiness).mockResolvedValue({
      date: "2026-08-24",
      sleepQuality: 1,
      fatigue: 5,
      stress: 5,
      soreness: 5,
      painArea: null,
      painLevel: 8,
      notes: null,
      readinessScore: 8,
      requiresReview: true,
    });
    render(<ReadinessCard />);
    await waitFor(() => expect(api.todayReadiness).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Salvar prontidão" }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        "Check-in salvo: revise o treino com a comissão."
      )
    );
  });

  it("exibe toast de falha ao salvar", async () => {
    const user = userEvent.setup();
    vi.mocked(api.todayReadiness).mockResolvedValue(null);
    vi.mocked(api.saveReadiness).mockRejectedValue(new Error("offline"));
    render(<ReadinessCard />);
    await waitFor(() => expect(api.todayReadiness).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Salvar prontidão" }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("Não foi possível salvar o check-in.")
    );
  });

  it("exibe toast de falha ao carregar a prontidão", async () => {
    vi.mocked(api.todayReadiness).mockRejectedValue(new Error("boom"));
    render(<ReadinessCard />);
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("Não foi possível carregar a prontidão.")
    );
  });
});
