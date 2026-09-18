export function PipelineKanbanIllustration() {
  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="Drag a candidate card between pipeline columns"
      className="mx-auto h-auto w-full max-w-[280px]"
    >
      <rect x="8" y="12" width="300" height="116" rx="8" fill="#f4f5f7" />
      <text x="52" y="32" fill="#272055" fontSize="11" fontWeight="600">
        Phone Screen
      </text>
      <text x="208" y="32" fill="#272055" fontSize="11" fontWeight="600">
        Shortlist
      </text>
      <line x1="160" y1="20" x2="160" y2="120" stroke="#d8dbe2" strokeWidth="1" />

      <rect x="24" y="44" width="112" height="72" rx="6" fill="#ffffff" stroke="#e2e5eb" />
      <rect x="176" y="44" width="112" height="72" rx="6" fill="#ffffff" stroke="#e2e5eb" />

      <circle cx="44" cy="64" r="10" fill="#31cdff" opacity="0.35" />
      <circle cx="44" cy="64" r="6" fill="#31cdff" />
      <rect x="58" y="58" width="56" height="6" rx="3" fill="#272055" opacity="0.2" />
      <rect x="58" y="70" width="40" height="5" rx="2.5" fill="#272055" opacity="0.12" />

      <g transform="translate(118, 78)">
        <rect
          x="0"
          y="0"
          width="88"
          height="44"
          rx="6"
          fill="#ffffff"
          stroke="#31cdff"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
        <circle cx="16" cy="16" r="8" fill="#31cdff" opacity="0.35" />
        <circle cx="16" cy="16" r="5" fill="#31cdff" />
        <rect x="30" y="12" width="44" height="5" rx="2.5" fill="#272055" opacity="0.25" />
        <rect x="30" y="22" width="32" height="4" rx="2" fill="#272055" opacity="0.15" />
      </g>

      <path
        d="M198 108 L210 118 L198 128 Z"
        fill="#272055"
        opacity="0.75"
      />
      <path
        d="M186 118 H208"
        stroke="#272055"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
