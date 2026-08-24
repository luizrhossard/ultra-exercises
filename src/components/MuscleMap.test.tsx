import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MuscleMap from "./MuscleMap";
import { MUSCLE_LABEL } from "../types";

describe("MuscleMap — mapa muscular", () => {
  it("renderiza figuras de frente e costas com rótulos dos músculos", () => {
    render(<MuscleMap muscles={["peitoral", "core"]} />);
    expect(screen.getByRole("img", { name: "Mapa muscular — FRENTE" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mapa muscular — COSTAS" })).toBeInTheDocument();
    expect(screen.getByText(MUSCLE_LABEL.peitoral)).toBeInTheDocument();
    expect(screen.getByText(MUSCLE_LABEL.core)).toBeInTheDocument();
  });

  it("destaca somente as zonas dos músculos informados", () => {
    const { container } = render(<MuscleMap muscles={["quadriceps"]} />);
    const zones = container.querySelectorAll(".zone-active");
    // zona espelhada aparece nas duas figuras (frente + espelho)
    expect(zones.length).toBeGreaterThan(0);
    expect(screen.queryByText(MUSCLE_LABEL.dorsais)).not.toBeInTheDocument();
  });

  it("não destaca nenhuma zona sem músculos", () => {
    const { container } = render(<MuscleMap muscles={[]} />);
    expect(container.querySelectorAll(".zone-active")).toHaveLength(0);
  });
});
