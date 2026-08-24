import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TwoFactorSettings from "./TwoFactorSettings";

const mocks = vi.hoisted(() => ({
  token: { value: "tok-2fa" },
  toast: vi.fn(),
}));

vi.mock("../store", () => ({
  useApp: () => ({ token: mocks.token.value, toast: mocks.toast }),
}));

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {
    constructor(kind: string, msg: string) {
      super(msg);
      this.name = "ApiError";
    }
  },
  api: {
    twoFactorStatus: vi.fn(),
    setupTwoFactor: vi.fn(),
    activateTwoFactor: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    disableTwoFactor: vi.fn(),
  },
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: { value: string }) => (
    <svg data-testid="qr-svg" role="img" aria-label={`QR Code para ${props.value}`} />
  ),
}));

import { api, ApiError } from "../api";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.twoFactorStatus).mockResolvedValue({ enabled: false });
});

async function renderLoaded() {
  render(<TwoFactorSettings />);
  await screen.findByText("Inativo");
}

describe("TwoFactorSettings — ativação [UE-24]", () => {
  it("não renderiza nada enquanto o status carrega", () => {
    vi.mocked(api.twoFactorStatus).mockReturnValue(new Promise(() => {}));
    const { container } = render(<TwoFactorSettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it("trata falha de status como desativado", async () => {
    vi.mocked(api.twoFactorStatus).mockRejectedValue(new Error("offline"));
    await renderLoaded();
    expect(screen.getByText("Ativar 2FA")).toBeInTheDocument();
  });

  it("mostra status e botão de ativação quando desabilitado", async () => {
    await renderLoaded();
    expect(screen.getByText("Segurança · dois fatores")).toBeInTheDocument();
    expect(screen.getByText("Ativar 2FA")).toBeInTheDocument();
  });

  it("fluxo completo: setup, QR/chave, código e códigos de recuperação", async () => {
    const user = userEvent.setup();
    vi.mocked(api.setupTwoFactor).mockResolvedValue({
      secret: "SEGREDO123",
      otpauthUri: "otpauth://totp/Forja",
    });
    vi.mocked(api.activateTwoFactor).mockResolvedValue({
      recoveryCodes: ["AAAA-BBBB", "CCCC-DDDD"],
    });
    await renderLoaded();

    await user.click(screen.getByText("Ativar 2FA"));
    await screen.findByTestId("qr-svg");
    expect(screen.getByText("SEGREDO123")).toBeInTheDocument();

    // copia a chave manual
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Chave copiada"));
    expect(writeText).toHaveBeenCalledWith("SEGREDO123");

    // só dígitos, máximo 6
    const codeInput = screen.getByLabelText("Código do app");
    await user.type(codeInput, "12ab");
    expect(codeInput).toHaveValue("12");
    const confirmBtn = screen.getByRole("button", { name: "Confirmar ativação" });
    expect(confirmBtn).toBeDisabled();

    await user.type(codeInput, "3456");
    expect(codeInput).toHaveValue("123456");
    await user.click(confirmBtn);

    await screen.findByText(/Guarde estes códigos em local seguro/);
    expect(screen.getByText("AAAA-BBBB")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith("2FA ativado", "#34d97b");

    // confirmação obrigatória antes de concluir
    const done = screen.getByRole("button", { name: "Concluir" });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(done);

    await screen.findByText("Ativo");
    expect(screen.getByRole("button", { name: /Gerar novos códigos de recuperação/ })).toBeInTheDocument();
  });

  it("exibe erro de ApiError na ativação", async () => {
    const user = userEvent.setup();
    vi.mocked(api.setupTwoFactor).mockResolvedValue({
      secret: "S",
      otpauthUri: "otpauth://x",
    });
    vi.mocked(api.activateTwoFactor).mockRejectedValue(new ApiError("http", "Código inválido."));
    await renderLoaded();

    await user.click(screen.getByText("Ativar 2FA"));
    await screen.findByLabelText("Código do app");
    await user.type(screen.getByLabelText("Código do app"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar ativação" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Código inválido.");
  });
});

describe("TwoFactorSettings — conta protegida", () => {
  async function renderEnabled() {
    vi.mocked(api.twoFactorStatus).mockResolvedValue({ enabled: true });
    render(<TwoFactorSettings />);
    await screen.findByText("Ativo");
  }

  it("regenera códigos com reautenticação forte", async () => {
    const user = userEvent.setup();
    vi.mocked(api.regenerateRecoveryCodes).mockResolvedValue({
      recoveryCodes: ["NOVO-0001"],
    });
    await renderEnabled();

    await user.click(screen.getByRole("button", { name: /Gerar novos códigos de recuperação/ }));
    const submit = screen.getByRole("button", { name: "Gerar novos códigos" });
    expect(submit).toBeDisabled(); // exige senha + código

    await user.type(screen.getByLabelText("Senha atual"), "senha123");
    await user.type(screen.getByLabelText("Código do app autenticador"), "654321");
    await user.click(submit);

    await screen.findByText("NOVO-0001");
    expect(api.regenerateRecoveryCodes).toHaveBeenCalledWith("tok-2fa", "senha123", "654321");
  });

  it("desativa 2FA com reautenticação forte", async () => {
    const user = userEvent.setup();
    vi.mocked(api.disableTwoFactor).mockResolvedValue(undefined);
    await renderEnabled();

    await user.click(screen.getByRole("button", { name: "Desativar 2FA" }));
    await user.type(screen.getByLabelText("Senha atual"), "senha123");
    await user.type(screen.getByLabelText("Código do app autenticador"), "111222");
    await user.click(screen.getByRole("button", { name: "Desativar 2FA" }));

    await screen.findByText("Inativo");
    expect(api.disableTwoFactor).toHaveBeenCalledWith("tok-2fa", "senha123", "111222");
    expect(mocks.toast).toHaveBeenCalledWith("2FA desativado");
  });

  it("cancela a ação sensível e limpa o formulário", async () => {
    const user = userEvent.setup();
    await renderEnabled();

    await user.click(screen.getByRole("button", { name: "Desativar 2FA" }));
    await user.type(screen.getByLabelText("Senha atual"), "senha123");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar novos códigos de recuperação/ })).toBeInTheDocument();
  });

  it("mostra mensagem genérica em erro que não é ApiError", async () => {
    const user = userEvent.setup();
    vi.mocked(api.disableTwoFactor).mockRejectedValue(new Error("boom"));
    await renderEnabled();

    await user.click(screen.getByRole("button", { name: "Desativar 2FA" }));
    await user.type(screen.getByLabelText("Senha atual"), "senha123");
    await user.type(screen.getByLabelText("Código do app autenticador"), "111222");
    await user.click(screen.getByRole("button", { name: "Desativar 2FA" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível concluir a operação.");
  });
});
