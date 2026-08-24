import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "./store";

vi.mock("./api", () => ({
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(kind: string, msg: string, details?: { status?: number }) {
      super(msg);
      this.name = "ApiError";
      this.status = details?.status;
    }
  },
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    verifyTwoFactor: vi.fn(),
    saveProfile: vi.fn(),
  },
}));

import { api } from "./api";
import { clearCache, setCache, userCacheKey, CACHE_TTL } from "./cache";

function Probe() {
  const s = useApp();
  return (
    <div>
      <span data-testid="state">
        {JSON.stringify({
          token: s.token,
          sports: s.profile.sports,
          onboarded: s.profile.onboarded,
          name: s.profile.name,
          tab: s.tab,
          playerId: s.playerId,
          pending: s.pendingChallenge,
        })}
      </span>
      <span data-testid="erro">{(s as unknown as { __err?: string }).__err ?? ""}</span>
      <button onClick={() => s.toggleSport("futebol")}>toggle-futebol</button>
      <button onClick={() => s.toggleSport("basquete")}>toggle-basquete</button>
      <button onClick={() => s.logout()}>logout</button>
      <button onClick={() => s.resetAll()}>reset-all</button>
      <button onClick={() => s.openPlayer("ex-1")}>abrir-player</button>
      <button onClick={() => s.closePlayer()}>fechar-player</button>
      <button onClick={() => s.setTab("rotinas")}>ir-rotinas</button>
      <button onClick={() => s.setName("Novo Nome")}>set-name</button>
      <button
        onClick={() =>
          s.completeOnboarding("Ana", ["futebol"]).catch((e: Error) => {
            (s as unknown as { __err?: string }).__err = e.message;
            document.querySelector("[data-testid=erro]")!.textContent = e.message;
          })
        }
      >
        completar-onboarding
      </button>
      <button
        onClick={() =>
          s.verifyChallenge("000000").catch((e: Error) => {
            document.querySelector("[data-testid=erro]")!.textContent = e.message;
          })
        }
      >
        verificar-desafio
      </button>
    </div>
  );
}

function state(): {
  token: string | null;
  sports: string[];
  onboarded: boolean;
  name: string;
  tab: string;
  playerId: string | null;
  pending: string | null;
} {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearCache();
});

describe("store — guards e resiliência", () => {
  it("não remove o último esporte ativo", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "forja:profile:v1",
      JSON.stringify({ name: "Ana", sports: ["futebol"], onboarded: true })
    );
    render(<AppProvider><Probe /></AppProvider>);

    await user.click(screen.getByText("toggle-futebol"));
    expect(state().sports).toEqual(["futebol"]); // guarda: mínimo 1 esporte

    await user.click(screen.getByText("toggle-basquete"));
    expect(state().sports).toEqual(["futebol", "basquete"]);

    await user.click(screen.getByText("toggle-basquete"));
    expect(state().sports).toEqual(["futebol"]);
  });

  it("completeOnboarding sem token lança erro amigável", async () => {
    const user = userEvent.setup();
    render(<AppProvider><Probe /></AppProvider>);
    await user.click(screen.getByText("completar-onboarding"));
    await waitFor(() =>
      expect(screen.getByTestId("erro")).toHaveTextContent("Sua sessão expirou. Entre novamente.")
    );
  });

  it("verifyChallenge sem desafio pendente lança erro amigável", async () => {
    const user = userEvent.setup();
    render(<AppProvider><Probe /></AppProvider>);
    await user.click(screen.getByText("verificar-desafio"));
    await waitFor(() =>
      expect(screen.getByTestId("erro")).toHaveTextContent(
        "Sessão de verificação ausente. Entre novamente."
      )
    );
  });

  it("logout limpa token, perfil e desafio pendente", async () => {
    const user = userEvent.setup();
    localStorage.setItem("forja:token:v1", "tok-store");
    vi.mocked(api.me).mockResolvedValue({
      email: "a@b.c",
      name: "Ana",
      sports: [{ code: "futebol", name: "Futebol", level: "COMPETITIVE" }],
    });
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(state().onboarded).toBe(true));

    await user.click(screen.getByText("logout"));
    expect(state()).toMatchObject({ token: null, sports: [], onboarded: false, tab: "explorar" });
    expect(localStorage.getItem("forja:token:v1")).toBeNull();
  });

  it("resetAll fecha o player e volta ao perfil inicial", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "forja:profile:v1",
      JSON.stringify({ name: "Ana", sports: ["futebol"], onboarded: true })
    );
    render(<AppProvider><Probe /></AppProvider>);

    await user.click(screen.getByText("abrir-player"));
    expect(state().playerId).toBe("ex-1");
    await user.click(screen.getByText("ir-rotinas"));
    expect(state().tab).toBe("rotinas");

    await user.click(screen.getByText("reset-all"));
    expect(state()).toMatchObject({ playerId: null, tab: "explorar", sports: [], onboarded: false });
  });

  it("closePlayer fecha o overlay mantendo o resto", async () => {
    const user = userEvent.setup();
    render(<AppProvider><Probe /></AppProvider>);
    await user.click(screen.getByText("abrir-player"));
    await user.click(screen.getByText("fechar-player"));
    expect(state().playerId).toBeNull();
  });

  it("perfil corrompido no localStorage cai no padrão", () => {
    localStorage.setItem("forja:profile:v1", "{json quebrado");
    render(<AppProvider><Probe /></AppProvider>);
    expect(state()).toMatchObject({ name: "", sports: [], onboarded: false });
  });

  it("falha de rede com perfil em cache mantém a sessão (modo offline)", async () => {
    const token = "tok-offline";
    localStorage.setItem("forja:token:v1", token);
    setCache(
      userCacheKey(token),
      "me",
      { email: "a@b.c", name: "Ana", sports: [{ code: "futebol", name: "Futebol", level: "COMPETITIVE" }] },
      CACHE_TTL.profile
    );
    vi.mocked(api.me).mockRejectedValue(new TypeError("sem conexão"));

    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    await waitFor(() => expect(state()).toMatchObject({ token, onboarded: true }));
    expect(localStorage.getItem("forja:token:v1")).toBe(token);
  });

  it("setName atualiza apenas o nome local", async () => {
    const user = userEvent.setup();
    render(<AppProvider><Probe /></AppProvider>);
    await user.click(screen.getByText("set-name"));
    expect(state().name).toBe("Novo Nome");
  });
});
