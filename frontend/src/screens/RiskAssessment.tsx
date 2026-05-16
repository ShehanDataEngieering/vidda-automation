import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertTriangle, ChevronRight, Sparkles, Gauge } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan, RiskDimensionScore } from '../types-v6';

const SCORE_MAP: Record<string, { color: string; bg: string; darkBg: string; width: string; icon: string; order: number }> = {
  Critical: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-950/30', width: 'w-full', icon: '🔴', order: 4 },
  High:     { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-950/30', width: 'w-3/4', icon: '🟠', order: 3 },
  Medium:   { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30', width: 'w-2/4', icon: '🟡', order: 2 },
  Low:      { color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50', darkBg: 'dark:bg-teal-950/30', width: 'w-1/4', icon: '🟢', order: 1 },
};

const DIM_ICONS: Record<string, string> = { 'AML Risk': '🏦', 'Sanctions Risk': '🚫', 'Fraud Risk': '🔍', 'Documentation Risk': '📋', 'Escalation Risk': '⚠️' };

export default function RiskAssessment() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { score: string; justification?: string }>>({});
  const [saving, setSaving] = useState(false);

  async function loadPlan() { if (!planId) return; const res = await api(`/api/pipeline/${planId}`); if (res.ok) setPlan(await res.json() as PipelinePlan); setLoading(false); }
  useEffect(() => { void loadPlan(); }, [planId]);

  async function assessRisk() {
    if (!planId) return; setAnalysing(true); setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/assess-risk`, { method: 'POST' });
      if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'Failed'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, current_step: 'risk' } : prev);
      setWarnings(data.warnings ?? []);
    } catch { setError('Connection error'); }
    finally { setAnalysing(false); }
  }

  async function saveOverrides() {
    if (!planId) return; setSaving(true);
    try {
      const res = await api(`/api/pipeline/${planId}/risk`, { method: 'PATCH', body: JSON.stringify({ overrides, reviewerNote: 'Compliance Officer review.' }) });
      if (!res.ok) { setError('Failed to save'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, version: data.version } : prev);
      setOverrides({});
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  }

  function toggleOverride(dim: string, score: string, justification: string) {
    setOverrides(prev => prev[dim] ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== dim)) : { ...prev, [dim]: { score, justification } });
  }
  function setOverrideScore(dim: string, score: string) { setOverrides(prev => ({ ...prev, [dim]: { ...prev[dim], score } })); }

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;

  if (!plan || !plan.role_profile) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0" /> Role not analysed yet. Complete Step 1 first.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}`)}>Go to Role Import</Button>
      </div>
    );
  }

  const hasRiskMatrix = plan.risk_matrix !== null && plan.risk_matrix !== undefined;
  const riskMatrix: RiskDimensionScore[] = plan.risk_matrix ?? [];
  const rp = plan.role_profile as { role_title: string; classified_as: string };
  const hasOverrides = Object.keys(overrides).length > 0;

  // Sort by severity descending
  const sortedDims = hasRiskMatrix ? [...riskMatrix].sort((a, b) => (SCORE_MAP[b.score]?.order ?? 0) - (SCORE_MAP[a.score]?.order ?? 0)) : [];

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="risk" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><Shield className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Risk Assessment</h1>
            <p className="text-sm text-muted-foreground">{rp.role_title} · <Badge variant="outline" className="text-xs">{rp.classified_as}</Badge></p>
          </div>
        </div>
      </div>

      {error && (<div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-4 w-4" /> {error}</div>)}
      {warnings.length > 0 && (<Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="py-3 space-y-1">{warnings.map((w,i)=><p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> {w}</p>)}</CardContent></Card>)}

      {/* Assess button */}
      {!hasRiskMatrix && (
        <Card className="mb-8 border-dashed border-2 shadow-none hover:border-primary/30 transition-colors">
          <CardContent className="py-12 text-center">
            <Gauge className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">Run AI Risk Assessment</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">The AI scores this role across 5 risk dimensions — AML, Sanctions, Fraud, Documentation, Escalation — on a Low / Medium / High / Critical scale, with a justification for each.</p>
            <Button size="lg" onClick={assessRisk} disabled={analysing} className="gap-2">{analysing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</> : <><Sparkles className="h-4 w-4" /> Run Risk Assessment</>}</Button>
          </CardContent>
        </Card>
      )}

      {hasRiskMatrix && (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {sortedDims.map((dim) => {
              const isOverridden = !!overrides[dim.dimension];
              const displayScore = isOverridden ? overrides[dim.dimension]?.score ?? dim.score : dim.score;
              const s = SCORE_MAP[displayScore]!;

              return (
                <Card key={dim.dimension} className={`shadow-sm transition-all duration-200 hover:shadow-md ${isOverridden ? 'ring-2 ring-amber-300 dark:ring-amber-700' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{DIM_ICONS[dim.dimension] ?? '•'}</span>
                        <div>
                          <CardTitle className="text-sm font-semibold">{dim.dimension}</CardTitle>
                          <div className="mt-1.5 h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${displayScore === 'Critical' ? 'bg-red-500' : displayScore === 'High' ? 'bg-orange-500' : displayScore === 'Medium' ? 'bg-amber-500' : 'bg-teal-500'} ${s.width}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverridden && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">Overridden</Badge>}
                        <Badge className={`${s.bg} ${s.darkBg} ${s.color} text-xs px-3 py-1 font-semibold`}>{displayScore}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 text-sm text-muted-foreground leading-relaxed">
                    <p>{dim.justification}</p>
                    {isOverridden ? (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2">Override Risk Score</p>
                        <div className="flex gap-1.5 mb-2">
                          {(['Low', 'Medium', 'High', 'Critical'] as const).map(sVal => {
                            const sm = SCORE_MAP[sVal]!;
                            return (
                              <button key={sVal} onClick={() => setOverrideScore(dim.dimension, sVal)}
                                className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded-md border transition-all ${
                                  displayScore === sVal ? `${sm.bg} ${sm.darkBg} border-amber-400 dark:border-amber-600 shadow-sm scale-105` : 'border-muted hover:border-amber-200 hover:bg-amber-50/50'
                                }`}>{sVal}</button>
                            );
                          })}
                        </div>
                        <button onClick={() => toggleOverride(dim.dimension, dim.score, dim.justification)} className="text-xs text-muted-foreground underline hover:text-foreground">Cancel override</button>
                      </div>
                    ) : (
                      <button onClick={() => toggleOverride(dim.dimension, dim.score, dim.justification)} className="mt-3 text-xs text-muted-foreground underline hover:text-foreground">Override this score</button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {hasOverrides && <Button onClick={saveOverrides} disabled={saving} variant="outline" size="lg" className="border-amber-300 text-amber-700">Save Overrides</Button>}
            <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/amlr`)} className="gap-2" disabled={hasOverrides && !saving}>Continue to AMLR Mapping <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
