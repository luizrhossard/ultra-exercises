import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../store";
import Auth from "./Auth";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {
    status?: number;
    traceId?: string;
    constructor(kind: string, msg: string, details?: { status?: number; traceId?: string }) {
      super(msg);
      this.name = "ApiError";
      this.status = details?.status;
      this.traceId = details?.traceId;
    }
  },
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    verifyTwoFactor: vi.fn(),
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

import { api, ApiError } from "../api";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // O store busca o perfil sempre que um token passa a existir.
  vi.mocked(api.me).mockResolvedValue({ email: "t@x.com", name: "T", sports: [] });
});

function renderAuth() {
  return render(
    <AppProvider>
      <Auth />
    </AppProvider>
  );
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  opts: { name?: string; email?: string; password?: string } = {}
) {
  if (opts.name !== undefined) await user.type(screen.getByPlaceholderText("Nome"), opts.name);
  await user.type(screen.getByPlaceholderText("E-mail"), opts.email ?? "joao@x.com");
  await user.type(screen.getByPlaceholderText(/Senha/), opts.password ?? "senha123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Auth — login e registro", () => {
  it("renderiza o formulário de login por padrão", () => {
    renderAuth();
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Senha/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nome")).not.toBeInTheDocument();
  });

  it("faz login com e-mail normalizado (trim)", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({ mfaRequired: false, token: "tok-1" });
    renderAuth();
    await fillAndSubmit(user, { email: "  joao@x.com  " });
    await waitFor(() => expect(api.login).toHaveBeenCalledWith("joao@x.com", "senha123"));
  });

  it("alterna para registro, envia nome e volta para login", async () => {
    const user = userEvent.setup();
    vi.mocked(api.register).mockResolvedValue({ mfaRequired: false, token: "tok-2" });
    renderAuth();

    await user.click(screen.getByText("Ainda não tenho conta"));
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Nome"), "Ana");
    await user.type(screen.getByPlaceholderText("E-mail"), "ana@x.com");
    await user.type(screen.getByPlaceholderText(/Senha/), "senha123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(api.register).toHaveBeenCalledWith("ana@x.com", "senha123", "Ana"));

    await user.click(screen.getByText("Já tenho uma conta"));
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("mostra mensagem e Ref de traceId em ApiError", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(
      new ApiError("http", "Credenciais inválidas.", { status: 401, traceId: "tr-abc" })
    );
    renderAuth();
    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Credenciais inválidas.");
    expect(screen.getByText("Ref: tr-abc")).toBeInTheDocument();
  });

  it("usa mensagem genérica para erros que não são ApiError", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(new Error("boom"));
    renderAuth();
    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível entrar.");
    expect(screen.queryByText(/Ref:/)).not.toBeInTheDocument();
  });

  it("limpa o erro ao alternar de modo", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(new ApiError("http", "Credenciais inválidas.", { status: 401 }));
    renderAuth();
    await fillAndSubmit(user);
    await screen.findByRole("alert");

    await user.click(screen.getByText("Ainda não tenho conta"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Auth — desafio 2FA [UE-24]", () => {
  async function enterChallenge(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(api.login).mockResolvedValue({ mfaRequired: true, challengeToken: "chal-1" });
    renderAuth();
    await fillAndSubmit(user);
    await screen.findByText("Verificação em dois fatores");
  }

  it("exibe desafio após login com mfaRequired", async () => {
    const user = userEvent.setup();
    await enterChallenge(user);
    expect(screen.getByLabelText("Código de verificação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("aceita apenas dígitos e habilita o botão com 6 dígitos", async () => {
    const user = userEvent.setup();
    await enterChallenge(user);

    const code = screen.getByLabelText("Código de verificação") as HTMLInputElement;
    await user.type(code, "12ab34");
    expect(code.value).toBe("1234");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    await user.type(code, "56");
    expect(code.value).toBe("123456");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("verifica o código e conclui a entrada", async () => {
    const user = userEvent.setup();
    vi.mocked(api.verifyTwoFactor).mockResolvedValue({ mfaRequired: false, token: "tok-final" });
    await enterChallenge(user);

    await user.type(screen.getByLabelText("Código de verificação"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(api.verifyTwoFactor).toHaveBeenCalledWith("chal-1", "123456")
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument()
    );
  });

  it("mostra erro de ApiError quando o código é inválido", async () => {
    const user = userEvent.setup();
    vi.mocked(api.verifyTwoFactor).mockRejectedValue(
      new ApiError("http", "Código inválido ou expirado.", { status: 401 })
    );
    await enterChallenge(user);

    await user.type(screen.getByLabelText("Código de verificação"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Código inválido ou expirado.");
  });

  it("alterna para código de recuperação (maiúsculas, 9 caracteres)", async () => {
    const user = userEvent.setup();
    await enterChallenge(user);

    await user.click(screen.getByText("Usar código de recuperação"));
    const code = screen.getByLabelText("Código de recuperação") as HTMLInputElement;
    expect(screen.getByText("Informe um dos seus códigos de recuperação de uso único.")).toBeInTheDocument();

    await user.type(code, "abcd-1234");
    expect(code.value).toBe("ABCD-1234");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("volta para o login ao cancelar o desafio", async () => {
    const user = userEvent.setup();
    await enterChallenge(user);

    await user.click(screen.getByText("Voltar para o login"));
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("Verificação em dois fatores")).not.toBeInTheDocument();
  });
});
