import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../store";
import { clearCache } from "../cache";
import Progress from "./Progress";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {
    status?: number;
  },
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    saveProfile: vi.fn(),
    progressWeeklySummary: vi.fn(),
    progressReadinessTrend: vi.fn(),
    progressSessions: vi.fn(),
    progressHistoryExercises: vi.fn(),
    progressHistoryStats: vi.fn(),
    exerciseEvolution: vi.fn(),
    volumeTrend: vi.fn(),
    performanceComparison: vi.fn(),
    alerts: vi.fn(),
    updateAlertSettings: vi.fn(),
  },
}));

import { api } from "../api";
import type { ApiProgressSessionsPage, ApiReadinessTrend } from "../api";

const summary = {
  periodStart: "2026-08-17",
  periodEnd: "2026-08-23",
  current: { sessionsCompleted: 4, totalDurationMinutes: 242, totalVolumeKg: 39200, averageRpe: 7.5, averageReadiness: 7.8 },
  previous: { sessionsCompleted: 2, totalDurationMinutes: 120, totalVolumeKg: 18000, averageRpe: 7, averageReadiness: 7.5 },
};

const page0: ApiProgressSessionsPage = {
  items: [
    { id: 1, routineName: "Treino A — Peito", sportName: "Futebol", status: "COMPLETED", scheduledAt: "2026-08-21T18:00:00Z", completedAt: "2026-08-21T19:00:00Z", durationMinutes: 58, sessionRpe: 8, maxPainLevel: null, totalVolumeKg: 12450, exerciseCount: 6, setCount: 18 },
    { id: 2, routineName: "Treino B — Pernas", sportName: "Corrida", status: "PLANNED", scheduledAt: "2026-08-22T10:00:00Z", completedAt: null, durationMinutes: null, sessionRpe: null, maxPainLevel: null, totalVolumeKg: null, exerciseCount: 5, setCount: 15 },
  ],
  page: 0,
  size: 20,
  totalItems: 3,
  totalPages: 2,
  hasNext: true,
};

const page1: ApiProgressSessionsPage = {
  items: [
    { id: 3, routineName: "Treino C", sportName: "Natação", status: "COMPLETED", scheduledAt: "2026-08-20T09:00:00Z", completedAt: "2026-08-20T10:00:00Z", durationMinutes: 45, sessionRpe: 6, maxPainLevel: 2, totalVolumeKg: 5000, exerciseCount: 4, setCount: 12 },
  ],
  page: 1,
  size: 20,
  totalItems: 3,
  totalPages: 2,
  hasNext: false,
};

const trend: ApiReadinessTrend = { periodDays: 30, items: [{ date: "2026-08-20", readiness: 8 }, { date: "2026-08-21", readiness: 7 }] };

beforeEach(() => {
  localStorage.clear();
  clearCache();
  vi.clearAllMocks();
  vi.mocked(api.me).mockResolvedValue({ email: "t@x.com", name: "T", sports: [] });
  vi.mocked(api.progressWeeklySummary).mockResolvedValue(summary);
  vi.mocked(api.progressReadinessTrend).mockResolvedValue(trend);
  vi.mocked(api.progressSessions).mockResolvedValue(page0);
  vi.mocked(api.progressHistoryExercises).mockResolvedValue([
    { id: 1, name: "Agachamento" },
    { id: 2, name: "Supino" },
  ]);
  vi.mocked(api.progressHistoryStats).mockResolvedValue({
    totalSessions: 7,
    completedSessions: 5,
    totalDurationMinutes: 320,
    totalVolumeKg: 21000,
    averageRpe: 7.2,
  });
  vi.mocked(api.exerciseEvolution).mockResolvedValue({
    exerciseId: 1,
    months: 6,
    items: [
      { date: "2026-08-20", maxLoadKg: 60 },
      { date: "2026-08-22", maxLoadKg: 70 },
    ],
  });
  vi.mocked(api.volumeTrend).mockResolvedValue({
    granularity: "week",
    months: 6,
    items: [{ periodStart: "2026-08-17", totalVolumeKg: 400 }],
  });
  vi.mocked(api.performanceComparison).mockResolvedValue({
    days: 30,
    current: { sessionsCompleted: 4, totalDurationMinutes: 240, totalVolumeKg: 12000, averageRpe: 7.5 },
    previous: { sessionsCompleted: 2, totalDurationMinutes: 120, totalVolumeKg: 6000, averageRpe: 7 },
  });
  vi.mocked(api.alerts).mockResolvedValue({
    enabled: true,
    maxSessionsPerWeek: 5,
    minRestHours: 48,
    alerts: [
      {
        type: "MUSCLE_REST",
        message: "Grupo 'peitoral' treinado com apenas 4h de descanso desde a última vez (mínimo configurado: 48h).",
      },
    ],
  });
  vi.mocked(api.updateAlertSettings).mockResolvedValue({
    enabled: true,
    maxSessionsPerWeek: 1,
    minRestHours: 48,
  });
});

function renderScreen() {
  localStorage.setItem("forja:token:v1", "token-progress");
  return render(
    <AppProvider>
      <Progress />
    </AppProvider>
  );
}

describe("tela Progresso [UE-44]", () => {
  it("exibe resumo semanal e histórico após carregar", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Treinos concluídos")).toBeInTheDocument());
    expect(screen.getByText(/242 min/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("Planejada")).toBeInTheDocument();
    // gráfico com alternativa textual acessível
    expect(screen.getByRole("img", { name: /prontidão nos últimos 30 dias/i })).toBeInTheDocument();
  });

  it("exibe estado vazio amigável sem treinos", async () => {
    vi.mocked(api.progressSessions).mockResolvedValue({ ...page0, items: [], totalItems: 0, totalPages: 0, hasNext: false });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/Você ainda não registrou treinos concluídos/i)).toBeInTheDocument()
    );
  });

  it("erro exibe opção de retry e recarrega os dados", async () => {
    vi.mocked(api.progressSessions).mockRejectedValueOnce(new Error("network"));
    renderScreen();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    vi.mocked(api.progressSessions).mockResolvedValue(page0);
    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
  });

  it("carregar mais busca a próxima página sem duplicar itens", async () => {
    vi.mocked(api.progressSessions).mockResolvedValueOnce(page0).mockResolvedValueOnce(page1);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /carregar mais/i }));

    await waitFor(() => expect(screen.getByText("Treino C")).toBeInTheDocument());
    expect(vi.mocked(api.progressSessions).mock.calls[1]).toEqual(["token-progress", 1, 20, {}]);
    expect(screen.getAllByText("Treino A — Peito").length).toBe(1);
    expect(screen.queryByRole("button", { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  it("tendência de prontidão lida com lista vazia", async () => {
    vi.mocked(api.progressReadinessTrend).mockResolvedValue({ periodDays: 30, items: [] });
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Sem check-ins de prontidão/i)).toBeInTheDocument());
  });

  it("indicador de dor aparece apenas quando houver dor registrada", async () => {
    vi.mocked(api.progressSessions).mockResolvedValue(page1);
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Dor máx\. 2\/10/i)).toBeInTheDocument());
  });

  it("sem autenticação não dispara requisições de progresso", async () => {
    render(
      <AppProvider>
        <Progress />
      </AppProvider>
    );
    await waitFor(() => expect(vi.mocked(api.progressSessions)).not.toHaveBeenCalled());
    expect(vi.mocked(api.progressWeeklySummary)).not.toHaveBeenCalled();
    expect(vi.mocked(api.progressReadinessTrend)).not.toHaveBeenCalled();
  });

  it("exibe barra de filtros e estatísticas do período [UE-30]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText("Buscar")).toBeInTheDocument());
    expect(screen.getByLabelText("Exercício")).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo muscular")).toBeInTheDocument();
    expect(screen.getByLabelText("Intensidade")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Treinos no período")).toBeInTheDocument());
    expect(screen.getByText("Concluídos")).toBeInTheDocument();
  });

  it("busca textual dispara requisição com o termo após o debounce [UE-30]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/rotina, esporte/i), "supino");
    await waitFor(() =>
      expect(vi.mocked(api.progressSessions).mock.calls.some((c) => c[3]?.q === "supino")).toBe(true)
    );
  });

  it("selecionar intensidade dispara requisição com o filtro [UE-30]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText("Intensidade"), "ALTA");
    await waitFor(() =>
      expect(vi.mocked(api.progressSessions).mock.calls.some((c) => c[3]?.intensity === "ALTA")).toBe(true)
    );
  });

  it("sem resultados com filtros ativos oferece limpar filtros [UE-30]", async () => {
    const emptyPage = { ...page0, items: [], totalItems: 0, totalPages: 0, hasNext: false };
    vi.mocked(api.progressSessions).mockImplementation((_t, _p, _s, filters) =>
      Promise.resolve(filters?.q ? emptyPage : page0)
    );
    renderScreen();
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/rotina, esporte/i), "nada");
    await waitFor(() => expect(screen.getByText(/Nenhum treino encontrado/i)).toBeInTheDocument());

    const clearButtons = screen.getAllByRole("button", { name: /limpar filtros/i });
    await userEvent.click(clearButtons[0]);
    await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
  });

  it("dashboard exibe gráficos de carga, volume e comparativo [UE-27]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/Carga máxima/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Volume semanal/i)).toBeInTheDocument();
    expect(screen.getByText(/Comparativo · últimos 30 dias/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /exportar png/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("trocar exercício da evolução dispara requisição com o id [UE-27]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/Exercício da evolução/i)).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText(/Exercício da evolução/i), "2");
    await waitFor(() =>
      expect(vi.mocked(api.exerciseEvolution).mock.calls.some((c) => c[1] === 2)).toBe(true)
    );
  });

  it("alternar granularidade do volume dispara requisição month [UE-27]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole("button", { name: /^meses$/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^meses$/i }));
    await waitFor(() =>
      expect(vi.mocked(api.volumeTrend).mock.calls.some((c) => c[1] === "month")).toBe(true)
    );
  });

  it("dashboard mostra estado vazio para atleta sem treinos [UE-27]", async () => {
    vi.mocked(api.progressHistoryExercises).mockResolvedValue([]);
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/Complete treinos para ver sua evolução/i)).toBeInTheDocument()
    );
  });

  it("exibe alertas de descanso quando existem [UE-28]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText(/peitoral/i)).toBeInTheDocument());
    expect(screen.getByText(/1 alerta de descanso/i)).toBeInTheDocument();
  });

  it("salva a sensibilidade de alertas [UE-28]", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /sensibilidade/i }));
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "1");
    await userEvent.click(screen.getByRole("button", { name: /salvar sensibilidade/i }));

    await waitFor(() =>
      expect(vi.mocked(api.updateAlertSettings)).toHaveBeenCalledWith("token-progress", {
        enabled: true,
        maxSessionsPerWeek: 1,
        minRestHours: 48,
      })
    );
  });
});
