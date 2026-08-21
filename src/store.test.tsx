import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "./store";
import { CACHE_TTL, clearCache, getCached, setCache, userCacheKey } from "./cache";

vi.mock("./api", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    saveProfile: vi.fn(),
  },
}));

import { api } from "./api";

function Probe() {
  const { token, logout, authenticate } = useApp();
  return (
    <div>
      <span data-testid="token">{token ?? "null"}</span>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => void authenticate("login", "a@b.c", "x", "N")}>login</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  clearCache();
  vi.clearAllMocks();
});

describe("store + cache", () => {
  it("logout limpa o cache do usuário", async () => {
    localStorage.setItem("forja:token:v1", "token-a");
    setCache(userCacheKey("token-a"), "routines", [1], CACHE_TTL.routines);
    vi.mocked(api.me).mockResolvedValue({ email: "a@b.c", name: "A", sports: [] });

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    expect(getCached(userCacheKey("token-a"), "routines")).toEqual([1]);

    await userEvent.click(screen.getByText("logout"));

    expect(getCached(userCacheKey("token-a"), "routines")).toBeUndefined();
    expect(screen.getByTestId("token").textContent).toBe("null");
  });

  it("novo login limpa o cache do usuário anterior (troca de conta)", async () => {
    localStorage.setItem("forja:token:v1", "token-antigo");
    setCache(userCacheKey("token-antigo"), "routines", [1], CACHE_TTL.routines);
    vi.mocked(api.me).mockResolvedValue({ email: "antigo@x", name: "X", sports: [] });
    vi.mocked(api.login).mockResolvedValue({ token: "token-novo", email: "novo@x", name: "N" });

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => {
      expect(getCached(userCacheKey("token-antigo"), "routines")).toBeUndefined();
    });
    expect(screen.getByTestId("token").textContent).toBe("token-novo");
  });
});