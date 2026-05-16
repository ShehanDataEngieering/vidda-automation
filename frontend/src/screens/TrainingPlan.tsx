import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Loader2, AlertTriangle, ChevronRight, ChevronDown, CheckCircle2, Trash2, Plus, Sparkles, Info } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan, TrainingPlan, TrainingModulePlan, PipelineSseEvent } from '../types-v6';

const QUARTER_NAMES: Record<string, string> = { Q1: 'Foundation', Q2: 'Application', Q3: 'Deepening', Q4: 'Embedding' };
const QUARTER_EMOJIS: Record<string, string> = { Q1: '🌱', Q2: '🚀', Q3: '🔬', Q4: '🏆' };
const RISK_COLORS: Record<string, string> = { 'AML Risk': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', 'Sanctions Risk': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', 'Fraud Risk': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', 'Documentation Risk': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', 'Escalation Risk': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };

export default function TrainingPlanScreen() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi(); const apiRef = useRef(api); apiRef.current = api;
  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [editPlan, setEditPlan] = useState<TrainingPlan | null>(null);
  const [activeQuarter, setActiveQuarter] = useState<string>('Q1');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  async function loadPlan() { if (!planId) return; const res = await api(`/api/pipeline/${planId}`); if (res.ok) { const d = await res.json() as PipelinePlan; setPlan(d); if (d.training_plan) setEditPlan(structuredClone(d.training_plan)); } setLoading(false); }
  useEffect(() => { void loadPlan(); }, [planId]);

  async function generatePlan() {
    if (!planId) return; setGenerating(true); setStreaming(true); setStreamText(''); setError('');
    try {
      const res = await apiRef.current(`/api/pipeline/${planId}/generate-plan`, { method: 'POST' });
      if (!res.ok || !res.body) { setError('Failed to start'); setGenerating(false); return; }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.slice(6)) as PipelineSseEvent;
          if (ev.type === 'token') setStreamText(prev => prev + ev.token);
          if (ev.type === 'done') { setEditPlan(ev.plan); setPlan(prev => prev ? { ...prev, training_plan: ev.plan, current_step: 'plan' } : prev); setWarnings((ev as { warnings?: string[] }).warnings ?? []); setStreaming(false); }
          if (ev.type === 'error') { setError(ev.message); setStreaming(false); }
        }
      }
    } catch { if (!streaming) return; setError('Connection error'); } finally { setGenerating(false); }
  }

  async function saveEdits() { if (!planId || !editPlan) return; await api(`/api/pipeline/${planId}/plan`, { method: 'PATCH', body: JSON.stringify({ trainingPlan: editPlan, reviewerNote: 'Compliance Manager review.' }) }); }
  async function approvePlan() {
    if (!planId) return;
    const res = await api(`/api/pipeline/${planId}/approve`, { method: 'PATCH', body: JSON.stringify({ reviewer: 'Compliance Manager' }) });
    if (res.ok) setPlan(prev => prev ? { ...prev, status: 'approved' } : prev);
  }
  function addModule(qIdx: number) { if (!editPlan) return; const copy = structuredClone(editPlan); copy.quarters[qIdx]!.modules.push({ module_name: 'New Module', duration_hours: 2, risk_dimension: 'AML Risk', amlr_article: 'Article 12', why_included: 'Added by Compliance Manager.' }); setEditPlan(copy); }
  function removeModule(qIdx: number, mIdx: number) { if (!editPlan) return; const copy = structuredClone(editPlan); copy.quarters[qIdx]!.modules.splice(mIdx, 1); setEditPlan(copy); }
  function updateModule(qIdx: number, mIdx: number, field: keyof TrainingModulePlan, value: string | number) {
    if (!editPlan) return; const copy = structuredClone(editPlan); const mod = copy.quarters[qIdx]!.modules[mIdx]!;
    if (field === 'duration_hours') mod.duration_hours = value as number; else (mod as unknown as Record<string, string | number>)[field] = value;
    setEditPlan(copy);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (!plan || !plan.amlr_mappings) {
    return (<div className="p-8 max-w-2xl mx-auto"><div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-5 w-5" /> AMLR mapping not complete.</div><Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/amlr`)}>Go to AMLR Mapping</Button></div>);
  }

  const isApproved = plan.status === 'approved';

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="plan" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />
      <div className="mb-8"><div className="flex items-center gap-3 mb-1"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><Calendar className="h-5 w-5 text-primary" /></div><div><h1 className="text-xl font-semibold tracking-tight">Training Plan</h1><p className="text-sm text-muted-foreground">{isApproved ? 'Approved' : '4-quarter AMLR compliance training plan'} — {plan.role_title}</p></div></div></div>
      {error && <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-4 w-4" /> {error}</div>}
      {warnings.length > 0 && <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="py-3 space-y-1">{warnings.map((w,i)=><p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> {w}</p>)}</CardContent></Card>}

      {!editPlan && !streaming && (
        <Card className="mb-8 border-dashed border-2 shadow-none hover:border-primary/30 transition-colors">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">Generate Training Plan</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">The AI generates a 4-quarter plan (Q1 Foundation → Q2 Application → Q3 Deepening → Q4 Embedding) with 5–7 modules each. RAG retrieves real AMLR text so every <i>why included</i> justification is verifiable.</p>
            <Button size="lg" onClick={generatePlan} disabled={generating} className="gap-2">{generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate Training Plan</>}</Button>
          </CardContent>
        </Card>
      )}

      {streaming && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /><p className="text-sm font-semibold text-primary">AI is generating your 4-quarter training plan…</p></div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-y-auto p-4 bg-background rounded-lg border">{streamText}<span className="animate-pulse text-primary">▌</span></pre>
          </CardContent>
        </Card>
      )}

      {editPlan && !streaming && (
        <>
          <Card className="mb-6 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
            <CardContent className="py-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">{editPlan.training_philosophy}</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-2">Total: {editPlan.quarters.reduce((s, q) => s + q.modules.length, 0)} modules across 4 quarters</p>
            </CardContent>
          </Card>

          {/* Quarter tabs */}
          <div className="flex gap-1 mb-6 border-b">
            {(['Q1','Q2','Q3','Q4'] as const).map(q => {
              const qIdx = q === 'Q1' ? 0 : q === 'Q2' ? 1 : q === 'Q3' ? 2 : 3;
              const modules = editPlan.quarters[qIdx]?.modules ?? [];
              const active = activeQuarter === q;
              return (
                <button key={q} onClick={() => setActiveQuarter(q)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-md ${
                    active ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}>
                  <span>{QUARTER_EMOJIS[q]}</span> {q} {QUARTER_NAMES[q]} <Badge variant="secondary" className="text-[10px] ml-1">{modules.length}</Badge>
                </button>
              );
            })}
          </div>

          {/* Active quarter modules */}
          {(['Q1','Q2','Q3','Q4'] as const).filter(q => q === activeQuarter).map(q => {
            const qIdx = q === 'Q1' ? 0 : q === 'Q2' ? 1 : q === 'Q3' ? 2 : 3;
            const modules = editPlan.quarters[qIdx]?.modules ?? [];

            return (
              <Card key={q} className="shadow-sm mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{QUARTER_EMOJIS[q]} {q} — {QUARTER_NAMES[q]}</CardTitle>
                    {!isApproved && <Button variant="ghost" size="sm" onClick={() => addModule(qIdx)}><Plus className="h-4 w-4" /></Button>}
                  </div>
                  <p className="text-xs text-muted-foreground">{editPlan.quarters[qIdx]?.months}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {modules.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No modules in this quarter yet.</p>}
                  {modules.map((m, mIdx) => {
                    const modKey = `${q}-${mIdx}`;
                    const isExpanded = expandedModule === modKey;
                    return (
                      <div key={mIdx} className="rounded-lg border p-4 text-sm bg-background hover:border-primary/20 transition-colors group">
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">{mIdx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input value={m.module_name} onChange={e => updateModule(qIdx, mIdx, 'module_name', e.target.value)} disabled={isApproved} className="h-7 text-sm font-semibold border-none bg-transparent px-0 flex-1" />
                              <Badge variant="outline" className="text-[10px] shrink-0">{m.duration_hours}h</Badge>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${RISK_COLORS[m.risk_dimension] ?? ''}`}>{m.risk_dimension}</Badge>
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] shrink-0">{m.amlr_article}</Badge>
                            </div>
                            <button onClick={() => setExpandedModule(isExpanded ? null : modKey)} className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <Info className="h-3.5 w-3.5 text-blue-500" /> Why included {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 animate-in slide-in-from-top-2 duration-200">
                                {isApproved ? <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{m.why_included}</p>
                                  : <Input value={m.why_included} onChange={e => updateModule(qIdx, mIdx, 'why_included', e.target.value)} className="h-7 text-xs border-none bg-transparent px-0 text-blue-700 dark:text-blue-300" />}
                              </div>
                            )}
                          </div>
                          {!isApproved && <button onClick={() => removeModule(qIdx, mIdx)} className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors mt-1 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Gate 3 controls */}
          {!isApproved && (
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" size="lg" onClick={saveEdits}>Save Edits</Button>
              <Button size="lg" onClick={approvePlan} className="gap-2 bg-emerald-600 hover:bg-emerald-700">Approve Plan <CheckCircle2 className="h-4 w-4" /></Button>
              <Button variant="outline" size="lg" onClick={() => navigate(`/pipeline/${planId}/lms`)}>LMS Assignment <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          {isApproved && (
            <div className="flex items-center gap-3 pt-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-sm px-4 py-2"><CheckCircle2 className="h-4 w-4 mr-1" /> Approved</Badge>
              <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/lms`)} className="gap-2">Assign Training <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
