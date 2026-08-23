import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { useState } from "react";

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("explosão de teste");
  return <p>conteúdo normal</p>;
}

describe("ErrorBoundary", () => {
  it("exibe fallback amigável quando um filho quebra na renderização", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ErrorBoundary><Bomb explode /></ErrorBoundary>);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Algo deu errado")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("recupera a interface ao clicar em Tentar novamente", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Scenario() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button onClick={() => setExplode(false)}>corrigir</button>
          <ErrorBoundary>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }

    render(<Scenario />);
    expect(screen.getByText("Algo deu errado")).toBeTruthy();

    // Reset com o filho ainda quebrado: o fallback permanece.
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(screen.getByRole("alert")).toBeTruthy();

    // Filho corrigido fora da barreira + novo reset: conteúdo volta.
    fireEvent.click(screen.getByText("corrigir"));
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(screen.getByText("conteúdo normal")).toBeTruthy();
    vi.restoreAllMocks();
  });
});
