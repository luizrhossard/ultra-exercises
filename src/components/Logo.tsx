import logoUrl from "../assets/logo-ultra.png";

/**
 * Logomarca Ultra Exercises. A arte original tem fundo preto embutido —
 * o container arredondado com borda sutil integra o recorte ao tema escuro.
 *
 * - `size`: altura fixa, largura proporcional (3:2) — para linhas com texto ao lado.
 * - `full`: ocupa toda a largura do container pai — banner de marca (sidebar).
 */
export function Logo({ size = 40, full = false }: { size?: number; full?: boolean }) {
  if (full) {
    return (
      <img
        src={logoUrl}
        alt="Ultra Exercises"
        className="h-auto w-full rounded-xl border border-ink-700 object-contain"
      />
    );
  }
  return (
    <img
      src={logoUrl}
      alt="Ultra Exercises"
      width={Math.round(size * 1.5)}
      height={size}
      style={{ width: Math.round(size * 1.5), height: size }}
      className="shrink-0 rounded-lg border border-ink-700 object-cover"
    />
  );
}

export default Logo;
