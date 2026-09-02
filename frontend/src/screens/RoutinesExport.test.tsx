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
  QRCodeSVG: (props: { value: string }) => (
    <svg data-testid="qr-svg" role="img" aria-label={`QR Code para ${props.value}`} />
  ),
}));

import { api } from "../api";

const routine = {
  id: 7,
  name: "Treino A — Peito",
  sportCode: "futebol",
  sportName: "Futebol",
  createdAt: "2026-08-22T10:00:00Z",
  items: [
    { exerciseId: 1, exerciseName: "Supino", position: 0, sets: 4, reps: "8", restTime: 90 },
    { exerciseId: 2, exerciseName: "Crucifixo", position: 1, sets: 3, reps: "10", restTime: 60 },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(api.me).mockResolvedValue({ email: "t@x.com", name: "T", sports: [] });
  vi.mocked(api.sports).mockResolvedValue([]);
  vi.mocked(api.routines).mockResolvedValue([routine]);
  vi.mocked(api.generateShareLink).mockResolvedValue({
    url: "http://localhost:3000/compartilhada/abc123",
  });
});

function renderScreen() {
  localStorage.setItem("forja:token:v1", "token-routines");
  return render(
    <AppProvider>
      <Routines />
    </AppProvider>
  );
}

async function expandCard() {
  await waitFor(() => expect(screen.getByText("Treino A — Peito")).toBeInTheDocument());
  await userEvent.click(screen.getByText("Treino A — Peito"));
  await waitFor(() => expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument());
}

describe("exportação e compartilhamento de rotinas [UE-29]", () => {
  it("expõe ações PDF, PNG, QR, WhatsApp e E-mail na rotina expandida", async () => {
    renderScreen();
    await expandCard();
    for (const label of ["PDF", "PNG", "QR", "WhatsApp", "E-mail"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("exporta PDF acionando a impressão do navegador [UE-29]", async () => {
    const printSpy = vi.fn();
    (window as unknown as { print: () => void }).print = printSpy;
    renderScreen();
    await expandCard();

    await userEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(printSpy).toHaveBeenCalled());
  });

  it("gera QR Code com o link público da rotina [UE-29]", async () => {
    renderScreen();
    await expandCard();

    await userEvent.click(screen.getByRole("button", { name: "QR" }));

    await waitFor(() => expect(screen.getByTestId("qr-svg")).toBeInTheDocument());
    expect(vi.mocked(api.generateShareLink)).toHaveBeenCalledWith("token-routines", 7);
    expect(screen.getByText(/compartilhada\/abc123/)).toBeInTheDocument();
  });

  it("compartilha via WhatsApp e E-mail com o texto da rotina [UE-29]", async () => {
    renderScreen();
    await expandCard();

    const wa = screen.getByRole("link", { name: "WhatsApp" });
    expect(wa).toHaveAttribute("href", expect.stringContaining("https://wa.me/?text="));
    expect(wa).toHaveAttribute("target", "_blank");

    const mail = screen.getByRole("link", { name: "E-mail" });
    expect(mail).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(mail.getAttribute("href")).toContain(encodeURIComponent("Supino"));
  });
});
