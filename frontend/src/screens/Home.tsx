import { useNavigate } from 'react-router-dom';
import { ShieldCheck, GitBranch, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientPanel } from '@/components/ui/gradient-panel';
import { IconChip } from '@/components/ui/icon-chip';
import { Logo } from '@/components/Logo';
import { brand } from '@/lib/brand';
import { PipelineStageArt } from '@/components/home/PipelineStageArt';
import { ArchitectureDiagram } from '@/components/home/ArchitectureDiagram';

const geist = { fontFamily: "'Geist', 'Inter', system-ui, sans-serif" };
const accentSerif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic' as const };

const STAGES = [
  {
    id: 'role' as const,
    eyebrow: 'Step 1',
    label: 'Role Import',
    body: 'Paste a job title and description. Vidda classifies it into one of five AMLR role archetypes — no manual tagging.',
  },
  {
    id: 'risk' as const,
    eyebrow: 'Step 2',
    label: 'Risk Assessment',
    body: 'The role is scored across five AMLR risk dimensions, each with a documented rationale a compliance officer can review.',
  },
  {
    id: 'amlr' as const,
    eyebrow: 'Step 3',
    label: 'AMLR Mapping',
    body: 'Risk scores are traced to the specific AMLR articles that mandate training — retrieved from the regulation text, not invented.',
  },
  {
    id: 'plan' as const,
    eyebrow: 'Step 4',
    label: 'Training Plan',
    body: 'A quarter-by-quarter curriculum is generated and held for human approval before anything reaches an employee.',
  },
];

const ENGINEERING_NOTES = [
  {
    title: 'Hybrid retrieval, not a single vector lookup',
    body: 'Regulation text is indexed two ways per query — Postgres full-text search (BM25) and pgvector cosine similarity — then fused with Reciprocal Rank Fusion (k=60), so a keyword hit on an exact legal term and a semantic hit on paraphrased intent both surface. The fused candidates are re-scored by a Voyage AI cross-encoder reranker before anything reaches the LLM.',
  },
  {
    title: 'The model can’t cite an article it wasn’t shown',
    body: 'Every AMLR mapping call gets the actual retrieved article excerpts injected into the prompt. Output is parsed against a Zod schema, then checked semantically — e.g. a cited article number outside the regulation’s real scope triggers a stricter retry with the same system prompt plus a corrective instruction, never a silent pass-through.',
  },
  {
    title: 'Every plan is scored before a human ever sees it',
    body: 'A hybrid quality scorer runs first: three deterministic checks — risk-coverage thresholds (Critical risk needs ≥ 3 modules), quarter-over-quarter pedagogical progression, and citation diversity — weighted 75%, plus an LLM-as-judge coherence rating at 25%. Low scores surface as warnings before the human approval gate, not after.',
  },
  {
    title: 'Two eval harnesses catch regressions before they ship',
    body: 'A RAG harness measures precision@5 / recall@5 / MRR against hand-verified ground truth per regulation; a pipeline harness runs all five known role archetypes through the live model and reports classification accuracy plus the quality-score breakdown — a before/after baseline for any prompt or model change.',
  },
];

const ROADMAP = [
  {
    title: 'Prompt caching',
    body: 'Cache the shared system prompt across the ~5 Claude calls per plan to cut latency and cost as usage scales.',
  },
  {
    title: 'CI-gated evals',
    body: 'Run the retrieval and pipeline-quality eval harnesses automatically on every prompt or model change, failing the build on regression.',
  },
  {
    title: 'Human-calibrated LLM judge',
    body: 'Periodically check the automated coherence scorer against real instructional-designer ratings to confirm it grades the way a human would.',
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ ...geist, background: brand.espresso, minHeight: '100vh' }}>
      {/* ── Nav ── */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo variant="dark" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sign-in')}
            className="text-sm font-medium"
            style={{ color: brand.creamText }}
          >
            Sign in
          </button>
          <Button
            onClick={() => navigate('/sign-up')}
            style={{ background: brand.amber, color: brand.espresso }}
            className="hover:opacity-90"
          >
            Get Started
          </Button>
        </div>
      </div>

      {/* ── Hero ── */}
      <GradientPanel variant="dark" className="mx-6 max-w-6xl md:mx-auto">
        <div className="relative px-6 py-16 md:px-14 md:py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl md:text-5xl font-semibold tracking-tight" style={{ color: brand.creamTextBright, textWrap: 'balance' }}>
            Compliance training that reads{' '}
            <span style={accentSerif}>the regulation</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: brand.creamText, opacity: 0.85 }}>
            Vidda turns a job role into a defensible, article-cited AMLR training plan —
            role import, risk scoring, and regulator-ready audit trail, in minutes instead of weeks.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed" style={{ color: brand.creamText, opacity: 0.6 }}>
            The EU's Anti-Money Laundering Regulation (2024/1624) takes effect in 2027, requiring
            obliged entities to prove that AML training is role-specific and risk-appropriate —
            not generic e-learning handed to every employee.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => navigate('/sign-up')}
              style={{ background: brand.amber, color: brand.espresso }}
              className="hover:opacity-90"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/sign-in')}
              style={{ borderColor: 'rgba(245,235,215,0.25)', color: brand.creamTextBright, background: 'transparent' }}
            >
              Sign in
            </Button>
          </div>
        </div>
      </GradientPanel>

      {/* ── How it works ── */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          How it works
        </p>
        <h2 className="mb-10 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          One pipeline, from job title to approved plan.
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage) => (
            <div key={stage.id} className="rounded-xl border p-4" style={{ borderColor: 'rgba(245,235,215,0.1)', background: 'rgba(245,235,215,0.03)' }}>
              <PipelineStageArt stage={stage.id} />
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>{stage.eyebrow}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: brand.creamTextBright }}>{stage.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: brand.creamText, opacity: 0.75 }}>{stage.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Live walkthrough ── */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          See it in action
        </p>
        <h2 className="mb-2 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          A real run, start to finish.
        </h2>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed" style={{ color: brand.creamText, opacity: 0.75 }}>
          This is an unedited recording of the actual app — a KYC role description going in, a live
          Anthropic API call at each step, real AMLR articles retrieved via RAG, and a 28-module plan
          coming out the other end, ending at the human approval gate.
        </p>
        <GradientPanel variant="dark" className="p-2 md:p-3">
          <img
            src="/media/pipeline-walkthrough.gif"
            alt="Screen recording of the Vidda pipeline: pasting a role description, AI role classification, risk scoring, AMLR article mapping, training plan generation, and approval."
            className="w-full rounded-lg"
          />
        </GradientPanel>
      </div>

      {/* ── Feature chips ── */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <IconChip
            icon={ShieldCheck}
            label="Risk Assessment"
            sub="Every role scored across five AMLR risk dimensions."
          />
          <IconChip
            icon={GitBranch}
            label="AMLR Mapping"
            sub="Obligations traced to the exact article that mandates them."
          />
          <IconChip
            icon={GraduationCap}
            label="Training Plan"
            sub="Role-specific modules, assigned and tracked to completion."
          />
        </div>
      </div>

      {/* ── Architecture ── */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          Under the hood
        </p>
        <h2 className="mb-2 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          Built on real retrieval, not a chatbot wrapper.
        </h2>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed" style={{ color: brand.creamText, opacity: 0.75 }}>
          Every citation is grounded by retrieval from the actual regulation text — hybrid BM25 +
          vector search, reranked, then reasoned over by Claude. Nothing is invented.
        </p>
        <GradientPanel variant="dark" className="p-4 md:p-8">
          <ArchitectureDiagram />
        </GradientPanel>
      </div>

      {/* ── Engineering deep-dive ── */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          For engineers
        </p>
        <h2 className="mb-8 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          What's actually running under each step.
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ENGINEERING_NOTES.map((note) => (
            <div key={note.title} className="rounded-xl border p-5" style={{ borderColor: 'rgba(245,235,215,0.1)', background: 'rgba(245,235,215,0.03)' }}>
              <p className="text-sm font-semibold" style={{ color: brand.amber }}>{note.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: brand.creamText, opacity: 0.8 }}>{note.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Roadmap ── */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          What's next
        </p>
        <h2 className="mb-8 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          Built for production, still hardening.
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ROADMAP.map((item) => (
            <div key={item.title} className="rounded-xl border p-4" style={{ borderColor: 'rgba(245,235,215,0.1)', background: 'rgba(245,235,215,0.03)' }}>
              <p className="text-sm font-semibold" style={{ color: brand.creamTextBright }}>{item.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: brand.creamText, opacity: 0.75 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-8 border-t pt-10 sm:grid-cols-3" style={{ borderColor: 'rgba(245,235,215,0.1)' }}>
          {[
            { value: '5 min', label: 'Role import → draft plan' },
            { value: 'RAG-grounded', label: 'Every citation traced to retrieved regulation text' },
            { value: '1 gate', label: 'Human approval before anything ships to staff' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-semibold" style={{ color: brand.amber, ...geist }}>{stat.value}</p>
              <p className="mt-1 text-sm" style={{ color: brand.creamText, opacity: 0.75 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t px-6 py-6" style={{ borderColor: 'rgba(245,235,215,0.08)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs" style={{ color: brand.creamText, opacity: 0.5 }}>
          <span>Vidda — AMLR compliance automation</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
