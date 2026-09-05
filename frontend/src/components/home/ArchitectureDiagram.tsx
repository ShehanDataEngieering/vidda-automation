import { brand } from '@/lib/brand';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  accent?: boolean;
}

const BROWSER: Box = { x: 20, y: 115, w: 160, h: 70, title: 'Browser', sub: 'React + Clerk session' };
const API: Box = { x: 300, y: 115, w: 160, h: 70, title: 'API Server', sub: 'Node / Express' };
const SERVICES: Box[] = [
  { x: 580, y: 8, w: 220, h: 56, title: 'Clerk', sub: 'Auth & session claims' },
  { x: 580, y: 82, w: 220, h: 56, title: 'Postgres + pgvector', sub: 'Regulatory corpus & pipeline data' },
  { x: 580, y: 156, w: 220, h: 56, title: 'Voyage AI', sub: 'Embeddings + reranking' },
  { x: 580, y: 230, w: 220, h: 56, title: 'Claude Sonnet 4.5', sub: 'Role, risk & plan reasoning', accent: true },
];

function centerRight(b: Box) { return { x: b.x + b.w, y: b.y + b.h / 2 }; }
function centerLeft(b: Box) { return { x: b.x, y: b.y + b.h / 2 }; }

function NodeBox({ box }: { box: Box }) {
  return (
    <g>
      <rect
        x={box.x} y={box.y} width={box.w} height={box.h} rx={10}
        fill={box.accent ? 'rgba(236,154,41,0.12)' : brand.espressoLight}
        stroke={box.accent ? brand.amber : 'rgba(245,235,215,0.15)'}
        strokeWidth={1.4}
      />
      <text x={box.x + box.w / 2} y={box.y + box.h / 2 - 4} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={brand.creamTextBright} fontFamily="Geist, sans-serif">
        {box.title}
      </text>
      <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 14} textAnchor="middle" fontSize="9.5" fill={brand.creamText} opacity={0.65} fontFamily="Geist, sans-serif">
        {box.sub}
      </text>
    </g>
  );
}

export function ArchitectureDiagram() {
  const browserOut = centerRight(BROWSER);
  const apiIn = centerLeft(API);
  const apiOut = centerRight(API);

  return (
    <svg viewBox="0 0 860 300" className="w-full" role="img" aria-label="Architecture: browser talks to the API server, which calls Clerk for auth, Postgres with pgvector for storage and retrieval, Voyage AI for embeddings and reranking, and Claude Sonnet 4.5 for reasoning.">
      <defs>
        <marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L8 4L0 8Z" fill={brand.amber} />
        </marker>
      </defs>

      {/* Browser -> API */}
      <line x1={browserOut.x} y1={browserOut.y} x2={apiIn.x - 6} y2={apiIn.y} stroke={brand.amber} strokeWidth="1.6" markerEnd="url(#arch-arrow)" />

      {/* API -> each service */}
      {SERVICES.map((svc) => {
        const svcIn = centerLeft(svc);
        return (
          <line
            key={svc.title}
            x1={apiOut.x} y1={apiOut.y}
            x2={svcIn.x - 6} y2={svcIn.y}
            stroke="rgba(245,235,215,0.35)"
            strokeWidth="1.3"
            markerEnd="url(#arch-arrow)"
          />
        );
      })}

      <NodeBox box={BROWSER} />
      <NodeBox box={API} />
      {SERVICES.map((svc) => <NodeBox key={svc.title} box={svc} />)}
    </svg>
  );
}
