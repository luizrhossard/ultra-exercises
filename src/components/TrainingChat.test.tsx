import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TrainingChat } from "./TrainingChat";
import { request } from "../api";
vi.mock("../api", () => ({ request: vi.fn(), ApiError: class extends Error {} }));
beforeEach(() => vi.resetAllMocks());
it("previews before saving and discards the proposal when editing", async () => {
  vi.mocked(request).mockResolvedValue({ message: "Proposta", proposalId: "abc", items: [{ exerciseId: 1, name: "Remada", sets: 2, reps: "8 reps", rest: 60 }] });
  render(<TrainingChat token="token" sportId={1} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Treino leve" } });
  fireEvent.click(screen.getByText("Enviar"));
  expect(await screen.findByText("Salvar proposta")).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Mude o treino" } });
  expect(screen.queryByText("Salvar proposta")).not.toBeInTheDocument();
});
it("saves only on confirmation and refreshes the routines", async () => {
  const saved = vi.fn();
  vi.mocked(request).mockResolvedValueOnce({ message: "Proposta", proposalId: "abc", items: [] }).mockResolvedValueOnce({ id: 1 });
  render(<TrainingChat token="token" sportId={1} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Sua mensagem"), { target: { value: "Treino leve" } });
  fireEvent.click(screen.getByText("Enviar"));
  fireEvent.click(await screen.findByText("Salvar proposta"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenLastCalledWith("/training-chat/save", expect.objectContaining({ body: JSON.stringify({ proposalId: "abc" }) }), "token");
});
