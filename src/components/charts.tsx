import { useRef } from "react";
import type { RefObject } from "react";

/**
 * [UE-27] Gráficos SVG leves (sem dependências) com alternativa textual para
 * leitores de tela e exportação como imagem PNG.
 */

export interface ChartPoint {
  label: string;
  value: number;
}

interface ChartProps {
  points: ChartPoint[];
  ariaLabel: string;
  filename: string;
  unit?: string;
}

const W = 320;
const H = 150;
const PAD = 14;

function scale(points: ChartPoint[]) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  return { x, y };
}

export function LineChart({ points, ariaLabel, filename, unit = "" }: ChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { x, y } = scale(points);
  const path = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label={ariaLabel}>
        <polyline
          points={path}
          fill="none"
          stroke="#d4f53c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r="3.5" fill="#d4f53c">
            <title>{`${p.label}: ${p.value}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={`${p.label}-${i}`}>{`${p.label}: ${p.value}${unit}`}</li>
        ))}
      </ul>
      <ExportPngButton svgRef={svgRef} filename={filename} />
    </div>
  );
}

export function BarChart({ points, ariaLabel, filename, unit = "" }: ChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const slot = (W - 2 * PAD) / points.length;
  const barWidth = Math.min(28, slot * 0.6);
  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label={ariaLabel}>
        {points.map((p, i) => {
          const barHeight = Math.max(2, (p.value / max) * (H - 2 * PAD));
          const bx = PAD + i * slot + (slot - barWidth) / 2;
          const by = H - PAD - barHeight;
          return (
            <rect key={`${p.label}-${i}`} x={bx} y={by} width={barWidth} height={barHeight} rx="3" fill="#d4f53c">
              <title>{`${p.label}: ${p.value}${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={`${p.label}-${i}`}>{`${p.label}: ${p.value}${unit}`}</li>
        ))}
      </ul>
      <ExportPngButton svgRef={svgRef} filename={filename} />
    </div>
  );
}

export function ExportPngButton({
  svgRef,
  filename,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  filename: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void exportSvgAsPng(svgRef.current, filename)}
      className="mt-2 inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fog-dim transition-colors hover:border-volt-400 hover:text-volt-300"
    >
      Exportar PNG
    </button>
  );
}

/** Serializa o SVG e baixa como PNG em 2x. Ambientes sem canvas (ex.: testes) falham silenciosamente. */
export async function exportSvgAsPng(svg: SVGSVGElement | null, filename: string): Promise<void> {
  try {
    if (!svg || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg-load"));
      img.src = url;
    });
    // Não trava em ambientes sem suporte a Image/canvas.
    await Promise.race([loaded, new Promise<void>((r) => window.setTimeout(r, 2000))]);
    const width = Math.round((svg.viewBox?.baseVal?.width || 640) * 2);
    const height = Math.round((svg.viewBox?.baseVal?.height || 300) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0c110d";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename;
      link.click();
    }
    URL.revokeObjectURL(url);
  } catch {
    // pipeline de exportação indisponível — ignora silenciosamente
  }
}
