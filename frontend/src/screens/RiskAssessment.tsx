import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, Loader2, AlertTriangle, ChevronRight, Sparkles, Gauge,
  Activity, Landmark, Ban, FileCheck, ArrowUpCircle,
  X, BarChart3, SlidersHorizontal
} from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan } from '../types-v6';

/* ── Lucide icons per dimension ── */
const DIM_META: Record<string, { icon: typeof Activity; color: string }> = {
  'AML Risk':          { icon: Landmark,  color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  'Sanctions Risk':    { icon: Ban,      color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40' },
  'Fraud Risk':        { icon: Activity,  color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  'Documentation Risk':{ icon: FileCheck, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40' },
  'Escalation Risk':   { icon: ArrowUpCircle, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
};

const SEVERITY_ORDER = ['Low', 'Medium', 'High', 'Critical'] as const;
const SEVERITY_CFG: Record<string, {
  color: string; bgLight: string; bgDark: string; border: string; dot: string;
}> = {
  Low:      { color: 'text-teal-700 dark:text-teal-300', bgLight: 'bg-teal-50', bgDark: 'dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', dot: 'bg-teal-500' },
  Medium:   { color: 'text-amber-700 dark:text-amber-300', bgLight: 'bg-amber-50', bgDark: 'dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  High:     { color: 'text-orange-700 dark:text-orange-300', bgLight: 'bg-orange-50', bgDark: 'dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  Critical: { color: 'text-red-700 dark:text-red-300', bgLight: 'bg-red-50', bgDark: 'dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
};

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

export default function RiskAssessment() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();

  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'heatmap'>('heatmap');

  // Override modal
  const [modalDim, setModalDim] = useState<string | null>(null);
  const [modalScore, setModalScore] = useState<string>('');
  const [modalNote, setModalNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadPlan() {
    if (!planId) return;
    setLoading(true);
    const res = await api(`/api/pipeline/${planId}`);
    if (res.ok) setPlan(await res.json() as PipelinePlan);
    setLoading(false);
  }

  useEffect(() => { void loadPlan(); }, [planId]);

  async function assessRisk() {
    if (!planId) return;
    setAnalysing(true); setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/assess-risk`, { method: 'POST' });
      if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'Failed'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, current_step: 'risk' } : prev);
      setWarnings(data.warnings ?? []);
    } catch { setError('Connection error'); }
    finally { setAnalysing(false); }
  }

  async function saveOverride(dim: string, score: string, note: string) {
    if (!planId) return;
    setSaving(true);
    try {
      const res = await api(`/api/pipeline/${planId}/risk`, {
        method: 'PATCH',
        body: JSON.stringify({ overrides: { [dim]: { score, justification: note } }, reviewerNote: note }),
      });
      if (!res.ok) { setError('Failed to save'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, version: data.version } : prev);
      setModalDim(null);
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  }

  async function overrideAllScore(score: string) {
    if (!planId || !plan?.risk_matrix) return;
    const overrides: Record<string, { score: string; justification: string }> = {};
    plan.risk_matrix.forEach(d => { overrides[d.dimension] = { score, justification: `Bulk override to ${score}` }; });
    setSaving(true);
    try {
      const res = await api(`/api/pipeline/${planId}/risk`, { method: 'PATCH', body: JSON.stringify({ overrides, reviewerNote: `Bulk override all to ${score}` }) });
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, version: data.version } : prev);
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;

  if (!plan || !plan.role_profile) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0" /> Role not analysed yet.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}`)}>Go to Role Import</Button>
      </div>
    );
  }

  const hasRiskMatrix = !!plan.risk_matrix?.length;
  const riskMatrix = plan.risk_matrix ?? [];
  const rp = plan.role_profile as { role_title: string; classified_as: string };

  // Sort by severity desc
  const sortedDims = [...riskMatrix].sort(
    (a, b) => (SEVERITY_ORDER.indexOf(b.score) - SEVERITY_ORDER.indexOf(a.score))
  );

  // Counts for gauge
  const scoreCounts: Record<string, number> = {};
  riskMatrix.forEach(d => { scoreCounts[d.score] = (scoreCounts[d.score] || 0) + 1; });

  // Heatmap: matrix[risk_dimension][severity] = boolean
  const matrix: Record<string, Record<string, boolean>> = {};
  riskMatrix.forEach(d => {
    matrix[d.dimension] = matrix[d.dimension] || {};
    const dimRow = matrix[d.dimension]!;
    SEVERITY_ORDER.forEach(sev => { dimRow[sev] = d.score === sev; });
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="risk" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
            <Shield className="h-5 w-5 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Risk Assessment</h1>
            <p className="text-sm text-muted-foreground">
              {rp.role_title} · <Badge variant="outline" className="text-xs">{rp.classified_as}</Badge>
            </p>
          </div>
        </div>
        {hasRiskMatrix && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => setViewMode(v => v === 'heatmap' ? 'cards' : 'heatmap')}>
              {viewMode === 'heatmap' ? <BarChart3 className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
              {viewMode === 'heatmap' ? 'Card View' : 'Heatmap'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-6 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> {w}</p>
          ))}
        </div>
      )}

      {/* ── Run Assessment CTA ── */}
      {!hasRiskMatrix && (
        <Card className="mb-8 border-dashed border-2 shadow-none">
          <CardContent className="py-12 text-center">
            <Gauge className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">Run AI Risk Assessment</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              AI scores 5 dimensions — AML, Sanctions, Fraud, Documentation, Escalation — on Low/Medium/High/Critical with justifications.
            </p>
            <Button size="lg" onClick={assessRisk} disabled={analysing} className="gap-2">
              {analysing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</> : <><Sparkles className="h-4 w-4" /> Run Assessment</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Heatmap View ── */}
      {hasRiskMatrix && viewMode === 'heatmap' && (
        <Card className="shadow-sm mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Risk Heatmap</CardTitle>
                <CardDescription className="text-xs mt-0.5">Click any cell to override score</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                  {SEVERITY_ORDER.map(sev => (
                    <div key={sev} className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${SEVERITY_CFG[sev]!.dot}`} />
                      <span className="text-[10px] text-muted-foreground font-medium">{sev}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Header row */}
            <div className="grid grid-cols-[160px_repeat(4,1fr)] gap-1 mb-1">
              <div />
              {SEVERITY_ORDER.map(sev => (
                <div key={sev} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center py-1.5">{sev}</div>
              ))}
            </div>
            {/* Dimension rows */}
            {riskMatrix.map(dim => {
              const meta = DIM_META[dim.dimension] ?? { icon: Activity, color: 'text-slate-500 bg-slate-50 dark:bg-slate-950/40' };
              const Icon = meta.icon;
              return (
                <div key={dim.dimension} className="grid grid-cols-[160px_repeat(4,1fr)] gap-1 mb-1">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{dim.dimension}</span>
                  </div>
                  {SEVERITY_ORDER.map(sev => {
                    const active = dim.score === sev;
                    const cfg = SEVERITY_CFG[sev]!;
                    return (
                      <button key={sev}
                        onClick={() => { setModalDim(dim.dimension); setModalScore(sev); }}
                        className={`relative h-10 rounded-md border transition-all cursor-pointer ${
                          active
                            ? `${cfg.bgLight} ${cfg.bgDark} ${cfg.border} shadow-sm`
                            : 'border-transparent bg-muted/30 hover:bg-muted/60'
                        }`}
                      >
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Summary bar */}
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Distribution</span>
              {SEVERITY_ORDER.map(sev => (
                <div key={sev} className="flex items-center gap-1 text-xs">
                   <div className={`h-1.5 w-1.5 rounded-full ${SEVERITY_CFG[sev]!.dot}`} />
                  <span className="text-muted-foreground">{scoreCounts[sev] ?? 0} {sev}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Card View (detail) ── */}
      {hasRiskMatrix && viewMode === 'cards' && (
        <div className="grid grid-cols-1 gap-4 mb-6">
          {sortedDims.map(dim => {
            const meta = DIM_META[dim.dimension] ?? { icon: Activity, color: 'text-slate-500 bg-slate-50 dark:bg-slate-950/40' };
            const Icon = meta.icon;
            const cfg = SEVERITY_CFG[dim.score]!;
            return (
              <Card key={dim.dimension} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{dim.dimension}</CardTitle>
                      </div>
                    </div>
                    <Badge className={`${cfg.bgLight} ${cfg.bgDark} ${cfg.color} text-xs px-3 py-1 font-semibold border ${cfg.border}`}>
                      {dim.score}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">{dim.justification}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setModalDim(dim.dimension); setModalScore(dim.score); }}>
                      <SlidersHorizontal className="h-3 w-3" /> Override
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Bulk actions ── */}
      {hasRiskMatrix && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bulk Override:</span>
            {SEVERITY_ORDER.map(sev => (
              <Button key={sev} variant="outline" size="sm" className="h-7 text-[10px] px-2"
                onClick={() => overrideAllScore(sev)} disabled={saving}>
                Set All {sev}
              </Button>
            ))}
          </div>
          <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/amlr`)} className="gap-2">
            Continue to AMLR Mapping <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Override Modal ── */}
      {modalDim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Override: {modalDim}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModalDim(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Current Score</p>
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                {riskMatrix.find(d => d.dimension === modalDim)?.score} — {riskMatrix.find(d => d.dimension === modalDim)?.justification}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">New Score</p>
              <div className="grid grid-cols-4 gap-2">
                {SEVERITY_ORDER.map(sev => {
                  const cfg = SEVERITY_CFG[sev]!;
                  return (
                    <button key={sev}
                      onClick={() => setModalScore(sev)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                        modalScore === sev
                          ? `${cfg.bgLight} ${cfg.bgDark} ${cfg.border} shadow-sm ring-1 ring-primary`
                          : 'border-muted hover:border-muted-foreground/30 bg-muted/20'
                      }`}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{sev}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Audit Note</p>
              <textarea
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                placeholder="Why is this override necessary? (Required for audit trail)"
                className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalDim(null)}>Cancel</Button>
              <Button
                disabled={!modalNote.trim() || saving}
                onClick={() => saveOverride(modalDim, modalScore, modalNote)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Override'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
