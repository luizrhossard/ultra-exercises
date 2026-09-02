import type { ApiRoutine } from "../api";

/** Texto plano da rotina para compartilhamento via WhatsApp/E-mail [UE-29]. */
export function routineShareText(routine: ApiRoutine): string {
  const lines = routine.items.map(
    (i) => `• ${i.exerciseName} — ${i.sets}×${i.reps} (descanso ${i.restTime}s)`
  );
  return `${routine.name} · ${routine.sportName}\n\n${lines.join("\n")}\n\n— via Forja`;
}

/** Folha em HTML para impressão/PDF pelo diálogo do navegador [UE-29].
 *  Estilizada em preto no branco via regras @media print do index.css. */
export function RoutinePrintSheet({ routine }: { routine: ApiRoutine }) {
  return (
    <div className="print-sheet">
      <p className="brand">FORJA</p>
      <h1>{routine.name}</h1>
      <p className="meta">
        {routine.sportName} · {routine.items.length} exercícios
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Exercício</th>
            <th>Séries</th>
            <th>Repetições</th>
            <th>Descanso</th>
          </tr>
        </thead>
        <tbody>
          {routine.items.map((item, i) => (
            <tr key={item.exerciseId}>
              <td>{i + 1}</td>
              <td>{item.exerciseName}</td>
              <td>{item.sets}</td>
              <td>{item.reps}</td>
              <td>{item.restTime}s</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>Gerado pelo app Forja · registre carga, RPE e descanso em cada sessão.</footer>
    </div>
  );
}

const ROW_H = 34;
const HEADER_H = 96;

/** Folha em SVG da rotina, para exportar como imagem PNG [UE-29]. */
export function RoutineSheetSvg({ routine }: { routine: ApiRoutine }) {
  const height = HEADER_H + routine.items.length * ROW_H + 44;
  return (
    <svg
      viewBox={`0 0 480 ${height}`}
      width="480"
      height={height}
      role="img"
      aria-label={`Rotina ${routine.name}: ${routine.items.length} exercícios.`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="480" height={height} fill="#101510" />
      <rect width="480" height="64" fill="#d4f53c" />
      <text x="20" y="30" fontFamily="sans-serif" fontSize="20" fontWeight="bold" fill="#0c110d">
        FORJA
      </text>
      <text x="20" y="52" fontFamily="sans-serif" fontSize="13" fill="#3a4423">
        {routine.sportName} · {routine.items.length} exercícios
      </text>
      <text x="20" y="86" fontFamily="sans-serif" fontSize="16" fontWeight="bold" fill="#e9eee7">
        {routine.name}
      </text>
      {routine.items.map((item, i) => {
        const top = HEADER_H + i * ROW_H;
        const name =
          item.exerciseName.length > 34 ? `${item.exerciseName.slice(0, 33)}…` : item.exerciseName;
        return (
          <g key={item.exerciseId}>
            {i % 2 === 1 && <rect x="12" y={top + 2} width="456" height={ROW_H - 6} rx="6" fill="#182016" />}
            <text x="24" y={top + 22} fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#e9eee7">
              {i + 1}. {name}
            </text>
            <text x="456" y={top + 22} textAnchor="end" fontFamily="sans-serif" fontSize="11" fill="#9aa39a">
              {item.sets}×{item.reps} · {item.restTime}s
            </text>
          </g>
        );
      })}
      <text x="240" y={height - 16} textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#6b756b">
        Gerado pelo app Forja
      </text>
    </svg>
  );
}
