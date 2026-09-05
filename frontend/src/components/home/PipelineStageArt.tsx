import { brand } from '@/lib/brand';

type Stage = 'role' | 'risk' | 'amlr' | 'plan';

const cream = brand.creamText;
const amber = brand.amber;
const dim = 'rgba(232,222,200,0.35)';

// Small illustrative mockups for each pipeline stage — abstract UI shapes,
// not literal screenshots, so they stay accurate as the real screens change.
function RoleArt() {
  return (
    <svg viewBox="0 0 240 96" className="h-24 w-full" aria-hidden="true">
      <rect x="8" y="16" width="88" height="64" rx="8" fill="none" stroke={dim} strokeWidth="1.5" />
      <line x1="20" y1="34" x2="84" y2="34" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="46" x2="72" y2="46" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="58" x2="78" y2="58" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <path d="M108 48h20" stroke={amber} strokeWidth="2" strokeLinecap="round" />
      <path d="M122 41l7 7-7 7" fill="none" stroke={amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="144" y="30" width="88" height="36" rx="18" fill={amber} />
      <text x="188" y="53" textAnchor="middle" fontSize="11" fontWeight="600" fill={brand.espresso} fontFamily="Geist, sans-serif">
        MLRO
      </text>
    </svg>
  );
}

function RiskArt() {
  const bars = [0.85, 0.55, 0.7, 0.4, 0.6];
  return (
    <svg viewBox="0 0 240 96" className="h-24 w-full" aria-hidden="true">
      {bars.map((v, i) => {
        const y = 10 + i * 17;
        const w = 190 * v;
        return (
          <g key={i}>
            <rect x="8" y={y} width="190" height="8" rx="4" fill="rgba(232,222,200,0.12)" />
            <rect x="8" y={y} width={w} height="8" rx="4" fill={v > 0.75 ? amber : cream} opacity={v > 0.75 ? 1 : 0.55} />
          </g>
        );
      })}
    </svg>
  );
}

function AmlrArt() {
  return (
    <svg viewBox="0 0 240 96" className="h-24 w-full" aria-hidden="true">
      <rect x="14" y="10" width="130" height="76" rx="8" fill="none" stroke={dim} strokeWidth="1.5" />
      <line x1="26" y1="28" x2="122" y2="28" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <line x1="26" y1="40" x2="110" y2="40" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <rect x="26" y="52" width="98" height="20" rx="4" fill="rgba(236,154,41,0.15)" stroke={amber} strokeWidth="1.2" />
      <line x1="34" y1="62" x2="112" y2="62" stroke={amber} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M150 50h18" stroke={amber} strokeWidth="2" strokeLinecap="round" />
      <path d="M163 44l7 6-7 6" fill="none" stroke={amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="180" y="34" width="52" height="30" rx="6" fill={amber} />
      <text x="206" y="53" textAnchor="middle" fontSize="10" fontWeight="700" fill={brand.espresso} fontFamily="Geist, sans-serif">
        Art. 12
      </text>
    </svg>
  );
}

function PlanArt() {
  const rows = [true, true, false, true];
  return (
    <svg viewBox="0 0 240 96" className="h-24 w-full" aria-hidden="true">
      <rect x="16" y="8" width="208" height="80" rx="8" fill="none" stroke={dim} strokeWidth="1.5" />
      {rows.map((done, i) => {
        const y = 20 + i * 18;
        return (
          <g key={i}>
            <rect x="28" y={y} width="14" height="14" rx="4" fill={done ? amber : 'none'} stroke={done ? amber : dim} strokeWidth="1.5" />
            {done && <path d={`M31 ${y + 7}l3 3 6-6`} fill="none" stroke={brand.espresso} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            <line x1="52" y1={y + 7} x2={done ? 190 : 150} y2={y + 7} stroke={cream} strokeWidth="3" strokeLinecap="round" opacity={done ? 0.55 : 0.3} />
          </g>
        );
      })}
    </svg>
  );
}

export function PipelineStageArt({ stage }: { stage: Stage }) {
  switch (stage) {
    case 'role': return <RoleArt />;
    case 'risk': return <RiskArt />;
    case 'amlr': return <AmlrArt />;
    case 'plan': return <PlanArt />;
  }
}
