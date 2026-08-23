interface P {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const base = (p: P) => ({
  width: p.size ?? 20,
  height: p.size ?? 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: p.strokeWidth ?? 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: p.className,
});

/* ================= SPORT ICONS ================= */

const Futebol = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 8.4l3.4 2.5-1.3 4h-4.2l-1.3-4L12 8.4z" />
    <path d="M12 8.4V3.4M15.4 10.9l4.8-1.5M14.1 14.9l3 4.1M9.9 14.9l-3 4.1M8.6 10.9L3.8 9.4" />
  </svg>
);

const Boxe = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.5 3.8h4.2a4.3 4.3 0 0 1 4.3 4.3v3.1a4.6 4.6 0 0 1-4.6 4.6H10a3.5 3.5 0 0 1-3.5-3.5v-.6l-1.6-1.5a2.6 2.6 0 0 1 0-3.7l1.9-1.7a2.4 2.4 0 0 1 1.7-1z" />
    <path d="M8 15.8v2.4a2 2 0 0 0 2 2h3.6a2 2 0 0 0 2-2v-2.4M12.7 3.8v5.4" />
  </svg>
);

const JiuJitsu = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 6.5l6.2 5.5-6.2 5.5M20.5 6.5l-6.2 5.5 6.2 5.5" />
    <rect x="9.8" y="9.8" width="4.4" height="4.4" rx="1" />
    <path d="M12 14.2v4.3" />
  </svg>
);

const Basquete = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 3.4v17.2M3.4 12h17.2" />
    <path d="M6 5.4a11.6 11.6 0 0 1 0 13.2M18 5.4a11.6 11.6 0 0 0 0 13.2" />
  </svg>
);

const Volei = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 3.4c1 3.4.4 6.6-1.8 8.9M12 12.3c3.3 1 6.5.3 8.6-1.8M12 12.3c-2.3 2.4-5.5 3-8.8 2.3" />
  </svg>
);

const Corrida = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 16.2c0-1.4 1-2.2 2.4-2.2h4.4l2.3-3.4 2.2 1.1c3 .1 5.7 2.1 6.7 4.5H3z" />
    <path d="M3 16.2v1.6h18v-1.6M9.5 10.5L8.2 8.6M14.6 14h2.6" />
  </svg>
);

const Natacao = (p: P) => (
  <svg {...base(p)}>
    <circle cx="16.4" cy="6.4" r="1.9" />
    <path d="M4 9.6c2.8-2.4 6-2.9 9.4-1.4" />
    <path d="M2.8 14.2c1.7-1.7 3.5-1.7 5.2 0s3.5 1.7 5.2 0 3.5-1.7 5.2 0 2.6 1.4 2.8 1.2M2.8 18.8c1.7-1.7 3.5-1.7 5.2 0s3.5 1.7 5.2 0 3.5-1.7 5.2 0" />
  </svg>
);

const Tenis = (p: P) => (
  <svg {...base(p)}>
    <g transform="rotate(-28 10 9)">
      <ellipse cx="10" cy="9" rx="5.4" ry="6.4" />
      <path d="M10 2.6v12.8M4.9 6.6h10.2M4.9 11.4h10.2" strokeWidth={1.1} />
    </g>
    <path d="M13.2 14.6L19 20.4" />
  </svg>
);

export function SportIcon({ id, size, className, strokeWidth }: P & { id: string }) {
  switch (id) {
    case "futebol": return <Futebol size={size} className={className} strokeWidth={strokeWidth} />;
    case "boxe": return <Boxe size={size} className={className} strokeWidth={strokeWidth} />;
    case "jiu-jitsu": return <JiuJitsu size={size} className={className} strokeWidth={strokeWidth} />;
    case "basquete": return <Basquete size={size} className={className} strokeWidth={strokeWidth} />;
    case "volei": return <Volei size={size} className={className} strokeWidth={strokeWidth} />;
    case "corrida": return <Corrida size={size} className={className} strokeWidth={strokeWidth} />;
    case "natacao": return <Natacao size={size} className={className} strokeWidth={strokeWidth} />;
    case "tenis": return <Tenis size={size} className={className} strokeWidth={strokeWidth} />;
    default: return <Futebol size={size} className={className} strokeWidth={strokeWidth} />;
  }
}

/* ================= UI ICONS ================= */

export const IconRadar = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="4.6" strokeDasharray="2.5 3" />
    <path d="M12 12l5.4-5.4" />
    <circle cx="14.6" cy="9.4" r="1.15" fill="currentColor" stroke="none" />
  </svg>
);

export const IconClipboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="4.4" width="14" height="16.2" rx="2.4" />
    <path d="M9 4.4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2v1.2M8.6 10.4h6.8M8.6 14h4.6M8.6 17.4h3" />
  </svg>
);

export const IconBolt = (p: P) => (
  <svg {...base(p)}>
    <path d="M13.2 2.6L5.6 13.4h5.2l-1 8 7.6-10.8h-5.2l1-8z" />
  </svg>
);

export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.4 20.4c1.3-3.6 4-5.4 7.6-5.4s6.3 1.8 7.6 5.4" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10.6" cy="10.6" r="6.2" />
    <path d="M15.4 15.4l4.6 4.6" />
  </svg>
);

export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.8 5.4L8.2 12l6.6 6.6" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </svg>
);

export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.4 12h13.2" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.4 6.6h15.2M9.6 6.6V4.8A1.4 1.4 0 0 1 11 3.4h2a1.4 1.4 0 0 1 1.4 1.4v1.8M6.4 6.6l.8 12.6a1.6 1.6 0 0 0 1.6 1.4h6.4a1.6 1.6 0 0 0 1.6-1.4l.8-12.6M10.2 10.6v6M13.8 10.6v6" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.4 5.2l10 6.8-10 6.8V5.2z" />
  </svg>
);

export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.6 5.6v12.8M15.4 5.6v12.8" strokeWidth={2.4} />
  </svg>
);

export const IconTimer = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13.2" r="7.4" />
    <path d="M12 9.4v3.8l2.6 1.8M9.8 2.6h4.4" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.8 12.6l4.6 4.6L19.2 7.4" />
  </svg>
);

export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.2 5.4l6.6 6.6-6.6 6.6" />
  </svg>
);

export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4M19.6 3.4v4.2h-4.2" />
  </svg>
);

export const IconGrip = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9h12M6 12h12M6 15h12" strokeWidth={2.2} />
  </svg>
);

export const IconDumbbell = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.2 8.2v7.6M15.8 8.2v7.6M4.6 9.8v4.4M19.4 9.8v4.4M8.2 12h7.6M2.6 12h2M19.4 12h2" />
  </svg>
);

export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.8s6.2 4.6 6.2 10a6.2 6.2 0 0 1-12.4 0c0-2.2 1-4.2 2.4-5.8.2 1.4.9 2.4 2 2.9C10 7.6 10.6 5 12 2.8z" />
  </svg>
);

export const IconTrend = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.6 16.8l5-5 3.6 3.6 8.2-8.2M15.6 7.2h4.8V12" />
  </svg>
);
