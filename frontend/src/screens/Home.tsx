import { useNavigate } from 'react-router-dom';
import { ShieldCheck, GitBranch, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientPanel } from '@/components/ui/gradient-panel';
import { IconChip } from '@/components/ui/icon-chip';
import { Logo, LogoMark } from '@/components/Logo';
import { brand } from '@/lib/brand';

const geist = { fontFamily: "'Geist', 'Inter', system-ui, sans-serif" };
const accentSerif = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic' as const };

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
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: 'rgba(245,235,215,0.2)', color: brand.amberLight }}>
            <LogoMark size={12} />
            AMLR 2024/1624 — deadline 2027
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl md:text-5xl font-semibold tracking-tight" style={{ color: brand.creamTextBright, textWrap: 'balance' }}>
            Compliance training that reads{' '}
            <span style={accentSerif}>the regulation</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: brand.creamText, opacity: 0.85 }}>
            Vidda turns a job role into a defensible, article-cited AMLR training plan —
            role import, risk scoring, and regulator-ready audit trail, in minutes instead of weeks.
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

      {/* ── What you get ── */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand.amber }}>
          What you get
        </p>
        <h2 className="mb-8 text-2xl font-semibold" style={{ color: brand.creamTextBright }}>
          One pipeline, from job title to approved plan.
        </h2>
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

      {/* ── Stats ── */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-8 border-t pt-10 sm:grid-cols-3" style={{ borderColor: 'rgba(245,235,215,0.1)' }}>
          {[
            { value: '5 min', label: 'Role import → draft plan' },
            { value: '100%', label: 'Article-cited, no invented obligations' },
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
