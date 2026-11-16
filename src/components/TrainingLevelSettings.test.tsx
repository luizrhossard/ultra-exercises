import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import TrainingLevelSettings from "./TrainingLevelSettings";
import { api } from "../api";
import { clearCache } from "../cache";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("../store", () => ({ useApp: () => ({ token: "token", toast }) }));
vi.mock("../api", () => ({ api: { me: vi.fn(), saveProfile: vi.fn() } }));
const profile = { email: "a@example.com", name: "Ana", sports: [{ code: "futebol", name: "Futebol", level: "RECREATIONAL" }] };
beforeEach(() => { vi.clearAllMocks(); clearCache(); });

it("persists the experience selected by the athlete", async () => {
  vi.mocked(api.me).mockResolvedValue(profile);
  vi.mocked(api.saveProfile).mockResolvedValue({ ...profile, sports: [{ ...profile.sports[0], level: "AMATEUR" }] });
  const user = userEvent.setup();
  render(<TrainingLevelSettings />);
  await user.selectOptions(await screen.findByRole("combobox", { name: "Futebol" }), "AMATEUR");
  await user.click(screen.getByRole("button", { name: "Salvar níveis" }));
  expect(api.saveProfile).toHaveBeenCalledWith("token", "Ana", ["futebol"], undefined, { futebol: "AMATEUR" });
  expect(toast).toHaveBeenCalledWith("Níveis salvos. O próximo treino usará essas informações.");
});

it("does not offer to save a profile that failed to load", async () => {
  vi.mocked(api.me).mockRejectedValue(new Error("offline"));
  render(<TrainingLevelSettings />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
  expect(screen.getByRole("button", { name: "Salvar níveis" })).toBeDisabled();
});
