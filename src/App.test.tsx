import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("./api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    verifyTwoFactor: vi.fn(),
    saveProfile: vi.fn(),
    todayReadiness: vi.fn(),
    saveReadiness: vi.fn(),
    sports: vi.fn(),
    exercisesFeed: vi.fn(),
    routines: vi.fn(),
    generateRoutine: vi.fn(),
    createSession: vi.fn(),
    startSession: vi.fn(),
    patchSession: vi.fn(),
    patchSessionItem: vi.fn(),
    generateShareLink: vi.fn(),
    sharedRoutine: vi.fn(),
    alerts: vi.fn(),
    updateAlertSettings: vi.fn(),
    twoFactorStatus: vi.fn(),
    progressWeeklySummary: vi.fn(),
    progressReadinessTrend: vi.fn(),
  },
}));

vi.mock("./screens/Auth", () => ({ default: () => <div>tela:auth</div> }));
vi.mock("./screens/Onboarding", () => ({ default: () => <div>tela:onboarding</div> }));
vi.mock("./screens/Feed", () => ({ default: () => <div>tela:feed</div> }));
vi.mock("./screens/Routines", () => ({ default: () => <div>tela:rotinas</div> }));
vi.mock("./screens/Progress", () => ({ default: () => <div>tela:progresso</div> }));
vi.mock("./screens/Profile", () => ({ default: () => <div>tela:perfil</div> }));
vi.mock("./screens/Player", () => ({ default: () => <div>overlay:player</div> }));
vi.mock("./screens/SharedRoutine", () => ({ default: () => <div>tela:compartilhada</div> }));
// Chrome de navegação tem testes próprios; aqui o foco é o roteamento do shell.
vi.mock("./components/Sidebar", () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock("./components/BottomNav", () => ({ default: () => <nav data-testid="bottomnav" /> }));

import { api } from "./api";
import { clearCache } from "./cache";

const ME_FULL = {
  email: "leo@x.com",
  name: "Léo",
  sports: [{ code: "futebol", name: "Futebol", level: "COMPETITIVE" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearCache(); // espelho em memória sobrevive ao localStorage.clear()
  window.history.pushState({}, "", "/");
});

describe("App — roteamento por estado de autenticação", () => {
  it("renderiza a tela de autenticação sem token", async () => {
    render(<App />);
    expect(await screen.findByText("tela:auth")).toBeInTheDocument();
  });

  it("mostra carregando enquanto o perfil é restaurado da sessão", async () => {
    // Token exclusivo: a promise pendente fica presa no inFlight do dedupeFetch
    // e não pode vazar para os outros testes (mesma chave de usuário).
    localStorage.setItem("forja:token:v1", "tok-carregando");
    vi.mocked(api.me).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(await screen.findByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByText("tela:auth")).not.toBeInTheDocument();
  });

  it("renderiza onboarding quando o perfil não tem esportes", async () => {
    localStorage.setItem("forja:token:v1", "tok-onboarding");
    vi.mocked(api.me).mockResolvedValue({ email: "leo@x.com", name: "", sports: [] });
    render(<App />);
    expect(await screen.findByText("tela:onboarding")).toBeInTheDocument();
  });

  it("renderiza o shell principal com navegação quando onboarded", async () => {
    localStorage.setItem("forja:token:v1", "tok-shell");
    vi.mocked(api.me).mockResolvedValue(ME_FULL);
    render(<App />);
    expect(await screen.findByText("tela:feed")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("bottomnav")).toBeInTheDocument();
    expect(screen.queryByText("tela:onboarding")).not.toBeInTheDocument();
  });

  it("rota pública de rotina compartilhada ignora o gate de autenticação", async () => {
    window.history.pushState({}, "", "/compartilhada/abc123");
    render(<App />);
    expect(await screen.findByText("tela:compartilhada")).toBeInTheDocument();
    expect(screen.queryByText("tela:auth")).not.toBeInTheDocument();
  });

  it("encerra a sessão quando o perfil remoto responde 401", async () => {
    const { ApiError } = await import("./api");
    localStorage.setItem("forja:token:v1", "tok-expirado");
    vi.mocked(api.me).mockRejectedValue(new ApiError("http", "Não autorizado.", { status: 401 }));
    render(<App />);
    expect(await screen.findByText("tela:auth")).toBeInTheDocument();
    expect(localStorage.getItem("forja:token:v1")).toBeNull();
  });
});
