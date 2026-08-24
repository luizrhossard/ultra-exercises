import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../store";
import Routines from "./Routines";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    saveProfile: vi.fn(),
    sports: vi.fn(),
    routines: vi.fn(),
    generateRoutine: vi.fn(),
    createSession: vi.fn(),
    startSession: vi.fn(),
    patchSession: vi.fn(),
    patchSessionItem: vi.fn(),
    generateShareLink: vi.fn(),
    sharedRoutine: vi.fn(),
  },
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: () => <svg data-testid="qr-svg" />,
}));

import { api, type ApiRoutine, type ApiSession, type ApiSport } from "../api";
import { clearCache } from "../cache";

const sport: ApiSport = { id: 1, code: "futebol", name: "Futebol", description: null };

const routine: ApiRoutine = {
  id: 7,
  name: "Treino A — Peito",
  sportCode: "futebol",
  sportName: "Futebol",
  createdAt: "2026-08-22T10:00:00Z",
  items: [
    { exerciseId: 1, exerciseName: "Supino", position: 0, sets: 4, reps: "8", restTime: 90 },
  ],
};

const plannedSession: ApiSession = {
  id: 8,
  routineId: 7,
  routineName: "Treino A — Peito",
  sportCode: "futebol",
  sportName: "Futebol",
  status: "PLANNED",
  scheduledAt: "2026-08-24T10:00:00Z",
  startedAt: null,
  completedAt: null,
  durationMinutes: null,
  sessionRpe: null,
  notes: null,
  items: [],
};

const activeSession: ApiSession = {
  ...plannedSession,
  id: 9,
  status: "IN_PROGRESS",
  startedAt: "2026-08-24T10:05:00Z",
  items: [
    {
      exerciseId: 1,
      exerciseName: "Supino",
      position: 0,
      prescribedSets: 4,
      prescribedReps: "8",
      prescribedRestTime: 90,
      completedSets: null,
      completedReps: null,
      loadKg: null,
      itemRpe: null,
      painLevel: null,
      notes: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearCache();
  localStorage.setItem(
    "forja:profile:v1",
    JSON.stringify({ name: "Ana", sports: ["futebol"], onboarded: true })
  );
  localStorage.setItem("forja:token:v1", currentToken);
  vi.mocked(api.me).mockResolvedValue({
    email: "a@b.c",
    name: "Ana",
    sports: [{ code: "futebol", name: "Futebol", level: "COMPETITIVE" }],
  });
  vi.mocked(api.sports).mockResolvedValue([sport]);
  vi.mocked(api.routines).mockResolvedValue([]);
});

let seq = 0;
let currentToken = "";

function renderScreen() {
  // Token exclusivo por teste: promises pendentes ficam presas no inFlight do
  // dedupeFetch e não podem vazar entre testes com a mesma chave de usuário.
  currentToken = `tok-${++seq}`;
  localStorage.setItem("forja:token:v1", currentToken);
  return render(
    <AppProvider>
      <Routines />
    </AppProvider>
  );
}

async function expandFirstCard(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Treino A — Peito");
  await user.click(screen.getByText("Treino A — Peito"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Iniciar sessão/ })).toBeInTheDocument()
  );
}

describe("Routines — geração de treino", () => {
  it("mostra skeleton enquanto as consultas carregam", () => {
    vi.mocked(api.sports).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.routines).mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByLabelText("Carregando rotinas")).toBeInTheDocument();
  });

  it("exibe estado vazio quando não há rotinas prescritas", async () => {
    renderScreen();
    expect(await screen.findByText("Gere sua primeira rotina acima.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar para Futebol/ })).toBeEnabled();
  });

  it("gera treino para o esporte em foco e atualiza a lista", async () => {
    const user = userEvent.setup();
    vi.mocked(api.generateRoutine).mockResolvedValue(routine);
    renderScreen();
    await screen.findByText("Gere sua primeira rotina acima.");

    await user.click(screen.getByRole("button", { name: /Gerar para Futebol/ }));

    await waitFor(() =>
      expect(api.generateRoutine).toHaveBeenCalledWith(currentToken, 1)
    );
    // refresh da lista após gerar
    await waitFor(() => expect(api.routines).toHaveBeenCalledTimes(2));
  });

  it("não gera quando a chamada falha, mas mantém a tela utilizável", async () => {
    const user = userEvent.setup();
    vi.mocked(api.generateRoutine).mockRejectedValue(new Error("offline"));
    renderScreen();
    await screen.findByText("Gere sua primeira rotina acima.");

    await user.click(screen.getByRole("button", { name: /Gerar para Futebol/ }));
    await waitFor(() => expect(api.generateRoutine).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Rotinas" })).toBeInTheDocument();
  });
});

describe("Routines — execução da sessão", () => {
  async function openActiveSession(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(api.routines).mockResolvedValue([routine]);
    vi.mocked(api.createSession).mockResolvedValue(plannedSession);
    vi.mocked(api.startSession).mockResolvedValue(activeSession);
    renderScreen();
    await expandFirstCard(user);
    await user.click(screen.getByRole("button", { name: /Iniciar sessão/ }));
    await screen.findByText("Executando · Futebol");
  }

  it("cria e inicia a sessão exibindo os exercícios prescritos", async () => {
    const user = userEvent.setup();
    await openActiveSession(user);

    expect(api.createSession).toHaveBeenCalledWith(currentToken, 7);
    expect(api.startSession).toHaveBeenCalledWith(currentToken, 8);
    // "Supino" aparece no cartão ao fundo e no painel da sessão
    expect(screen.getAllByText("Supino").length).toBeGreaterThan(0);
    expect(screen.getByText("Prescrito: 4 × 8")).toBeInTheDocument();
  });

  it("registra o exercício com séries, carga, rpe e dor", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patchSessionItem).mockResolvedValue(activeSession);
    await openActiveSession(user);

    const carga = screen.getByLabelText("Carga kg");
    await user.clear(carga);
    await user.type(carga, "50");

    await user.click(screen.getByRole("button", { name: "Registrar exercício" }));

    await waitFor(() =>
      expect(api.patchSessionItem).toHaveBeenCalledWith(currentToken, 9, 1, {
        completedSets: 4,
        completedReps: "8",
        loadKg: 50,
        itemRpe: 6,
        painLevel: 0,
      })
    );
  });

  it("conclui a sessão com duração e RPE e fecha o painel", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patchSession).mockResolvedValue({ ...activeSession, status: "COMPLETED" });
    await openActiveSession(user);

    await user.click(screen.getByRole("button", { name: /Concluir sessão/ }));

    await waitFor(() =>
      expect(api.patchSession).toHaveBeenCalledWith(currentToken, 9, {
        status: "COMPLETED",
        durationMinutes: 60,
        sessionRpe: 6,
      })
    );
    await waitFor(() =>
      expect(screen.queryByText("Executando · Futebol")).not.toBeInTheDocument()
    );
  });

  it("mantém o painel aberto quando registrar falha", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patchSessionItem).mockRejectedValue(new Error("offline"));
    await openActiveSession(user);

    await user.click(screen.getByRole("button", { name: "Registrar exercício" }));
    await waitFor(() => expect(api.patchSessionItem).toHaveBeenCalled());
    expect(screen.getByText("Executando · Futebol")).toBeInTheDocument();
  });
});
