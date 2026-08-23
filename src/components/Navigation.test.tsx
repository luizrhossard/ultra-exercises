import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "../store";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

vi.mock("../api", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    saveProfile: vi.fn(),
  },
}));

import { api } from "../api";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.me).mockResolvedValue({ email: "t@x.com", name: "T", sports: [] });
});

// [UE-41] A aba "Projeto" (blueprint técnico) foi removida da experiência do atleta.
describe("navegação sem a aba Projeto", () => {
  it("BottomNav exibe Explorar/Rotinas/Perfil e não exibe Projeto", () => {
    localStorage.setItem("forja:token:v1", "token-nav");
    render(
      <AppProvider>
        <BottomNav />
      </AppProvider>
    );
    expect(screen.getByLabelText("Explorar")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotinas")).toBeInTheDocument();
    expect(screen.getByLabelText("Progresso")).toBeInTheDocument();
    expect(screen.getByLabelText("Perfil")).toBeInTheDocument();
    expect(screen.queryByText("Projeto")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Projeto")).not.toBeInTheDocument();
  });

  it("Sidebar não exibe mais a aba Projeto nem o hint Blueprint técnico", () => {
    localStorage.setItem("forja:token:v1", "token-nav");
    render(
      <AppProvider>
        <Sidebar />
      </AppProvider>
    );
    expect(screen.getByText("Explorar")).toBeInTheDocument();
    expect(screen.getByText("Rotinas")).toBeInTheDocument();
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.queryByText("Projeto")).not.toBeInTheDocument();
    expect(screen.queryByText("Blueprint técnico")).not.toBeInTheDocument();
  });
});
