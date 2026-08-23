import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SharedRoutine from "./SharedRoutine";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    sharedRoutine: vi.fn(),
  },
}));

import { api } from "../api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tela de rotina compartilhada [UE-29]", () => {
  it("renderiza a prescrição compartilhada em somente leitura", async () => {
    vi.mocked(api.sharedRoutine).mockResolvedValue({
      name: "Treino A — Peito",
      sportName: "Futebol",
      items: [
        { exerciseName: "Supino", sets: 4, reps: "8", restTime: 90 },
        { exerciseName: "Crucifixo", sets: 3, reps: "10", restTime: 60 },
      ],
    });

    render(<SharedRoutine token="abc123" />);

    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
    expect(screen.getByText(/1\. Supino/i)).toBeInTheDocument();
    expect(screen.getByText(/4 × 8 · descanso 90s/i)).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/i)).toBeInTheDocument();
  });

  it("mostra mensagem amigável para token inválido", async () => {
    vi.mocked(api.sharedRoutine).mockRejectedValue(new Error("404"));

    render(<SharedRoutine token="invalido" />);

    await waitFor(() =>
      expect(screen.getByText(/não encontrada ou link inválido/i)).toBeInTheDocument()
    );
  });
});
