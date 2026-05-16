import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PipelinePlan, RiskDimensionScore } from '../types-v6';

// Score → color mapping matching brief's Low/Medium/High/Critical scale
const SCORE_COLORS: Record<string, string> = {
  Low: 'bg-teal-100 text-teal-700 border-teal-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Critical: 'bg-red-100 text-red-700 border-red-200',
};

const DIMENSION_ICONS: Record<string, string> = {
  'AML Risk': '🏦',
  'Sanctions Risk': '🚫',
  'Fraud Risk': '🔍',
  'Documentation Risk': '📋',
  'Escalation Risk': '⚠️',
};

export default function RiskAssessment() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();

  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Override state — dimension name → { newScore, note }
  const [overrides, setOverrides] = useState<Record<string, { score: string; justification?: string }>>({});
  const [saving, setSaving] = useState(false);

  // Load plan state from DB
  async function loadPlan() {
    if (!planId) return;
    const res = await api(`/api/pipeline/${planId}`);
    if (!res.ok) { setError('Plan not found'); setLoading(false); return; }
    const data = await res.json() as PipelinePlan;
    setPlan(data);
    setLoading(false);
  }
  useEffect(() => { void loadPlan(); }, [planId]);

  // Step 3: Run AI risk assessment
  async function assessRisk() {
    if (!planId) return;
    setAnalysing(true);
    setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/assess-risk`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Risk assessment failed');
        return;
      }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, current_step: 'risk' } : prev);
      setWarnings(data.warnings ?? []);
    } catch {
      setError('Connection error');
    } finally { setAnalysing(false); }
  }

  // Gate 1: Save human overrides
  async function saveOverrides() {
    if (!planId) return;
    setSaving(true);
    try {
      const res = await api(`/api/pipeline/${planId}/risk`, {
        method: 'PATCH',
        body: JSON.stringify({
          overrides,
          reviewerNote: 'Compliance Officer review — scores adjusted.',
        }),
      });
      if (!res.ok) { setError('Failed to save overrides'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, risk_matrix: data.riskMatrix, version: data.version } : prev);
      setOverrides({});
    } catch {
      setError('Connection error');
    } finally { setSaving(false); }
  }

  function toggleOverride(dimension: string, currentScore: string, currentJustification: string) {
    setOverrides(prev => {
      if (prev[dimension]) {
        const copy = { ...prev };
        delete copy[dimension];
        return copy;
      }
      return { ...prev, [dimension]: { score: currentScore, justification: currentJustification } };
    });
  }

  function setOverrideScore(dimension: string, score: string) {
    setOverrides(prev => ({ ...prev, [dimension]: { ...prev[dimension], score } }));
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  // Plan not found or missing previous step
  if (!plan || !plan.role_profile) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Role not analysed yet. Complete Step 1+2 first.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}`)}>Go to Role Import</Button>
      </div>
    );
  }

  const riskMatrix: RiskDimensionScore[] = plan.risk_matrix ?? [];
  const roleProfile = plan.role_profile as { role_title: string; classified_as: string };
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Step 2: Risk Assessment</h1>
          <p className="text-sm text-muted-foreground">
            {roleProfile.role_title} · classified as <Badge variant="outline" className="ml-1 text-xs">{roleProfile.classified_as}</Badge>
          </p>
        </div>
      </div>

      {/* Assess button — shown when no risk matrix yet */}
      {!riskMatrix && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              The AI will score this role across 5 risk dimensions (Low / Medium / High / Critical) with one-sentence justifications.
            </p>
            <Button onClick={assessRisk} disabled={analysing}>
              {analysing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</> : 'Run Risk Assessment'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {warnings.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk Matrix — 5 dimension cards */}
      {riskMatrix && (
        <>
          <div className="grid grid-cols-1 gap-3 mb-6">
            {riskMatrix.map((dim) => {
              const isOverridden = !!overrides[dim.dimension];
              const displayScore = isOverridden ? overrides[dim.dimension]?.score ?? dim.score : dim.score;
              const scoreColor = SCORE_COLORS[displayScore] ?? SCORE_COLORS.Medium;

              return (
                <Card key={dim.dimension} className={isOverridden ? 'border-amber-300' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{DIMENSION_ICONS[dim.dimension] ?? '•'}</span>
                        <CardTitle className="text-sm">{dim.dimension}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverridden && <Badge variant="warning" className="text-[10px]">Overridden</Badge>}
                        <Badge variant="outline" className={scoreColor}>{displayScore}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 text-xs">
                    <p className="text-muted-foreground leading-relaxed">{dim.justification}</p>

                    {/* Gate 1: Override controls */}
                    {isOverridden ? (
                      <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700 mb-2">Override Score</p>
                        <div className="flex gap-2 mb-2">
                          {(['Low', 'Medium', 'High', 'Critical'] as const).map(s => (
                            <button key={s} onClick={() => setOverrideScore(dim.dimension, s)}
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                                displayScore === s ? 'bg-amber-200 border-amber-400 font-bold' : 'border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => toggleOverride(dim.dimension, dim.score, dim.justification)}
                          className="text-xs text-muted-foreground underline">
                          Cancel override
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => toggleOverride(dim.dimension, dim.score, dim.justification)}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">
                        Override this score
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Gate 1: Save overrides or continue */}
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <Button onClick={saveOverrides} disabled={saving} variant="outline" className="text-amber-700 border-amber-300">
                Save Overrides
              </Button>
            )}
            <Button onClick={() => navigate(`/pipeline/${planId}/amlr`)} disabled={hasOverrides && !saving}>
              Continue to AMLR Mapping <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
