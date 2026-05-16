import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, AlertTriangle, ChevronRight, Plus, Trash2, Sparkles, Lightbulb } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan, AMLRMapping } from '../types-v6';

export default function AMLRMappingScreen() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editMappings, setEditMappings] = useState<AMLRMapping[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadPlan() { if (!planId) return; const res = await api(`/api/pipeline/${planId}`); if (res.ok) { const d = await res.json() as PipelinePlan; setPlan(d); if (d.amlr_mappings) setEditMappings([...d.amlr_mappings]); } setLoading(false); }
  useEffect(() => { void loadPlan(); }, [planId]);

  async function mapAMLR() {
    if (!planId) return; setMapping(true); setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/map-amlr`, { method: 'POST' });
      if (!res.ok) { setError((await res.json().catch(()=>({})))?.error ?? 'Failed'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, amlr_mappings: data.amlrMappings, current_step: 'amlr' } : prev);
      setEditMappings(data.amlrMappings as AMLRMapping[]); setWarnings(data.warnings ?? []);
    } catch { setError('Connection error'); } finally { setMapping(false); }
  }

  async function saveMappings() {
    if (!planId) return; setSaving(true);
    try {
      await api(`/api/pipeline/${planId}/amlr`, { method: 'PATCH', body: JSON.stringify({ mappings: editMappings, reviewerNote: 'Legal review — mapping confirmed.' }) });
    } catch { setError('Connection error'); } finally { setSaving(false); }
  }
  function addMapping() { setEditMappings(prev => [...prev, { article: 'Article 9', article_name: '', applies_because: '', training_obligation: '' }]); }
  function removeMapping(idx: number) { setEditMappings(prev => prev.filter((_, i) => i !== idx)); }
  function updateMapping(idx: number, field: keyof AMLRMapping, value: string) { setEditMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m)); }

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;

  if (!plan || !plan.risk_matrix) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-5 w-5" /> Risk assessment not complete.</div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/risk`)}>Go to Risk Assessment</Button>
      </div>
    );
  }

  const hasMappings = plan.amlr_mappings && plan.amlr_mappings.length > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="amlr" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />
      <div className="mb-8"><div className="flex items-center gap-3 mb-1"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><BookOpen className="h-5 w-5 text-primary" /></div><div><h1 className="text-xl font-semibold tracking-tight">AMLR Article Mapping</h1><p className="text-sm text-muted-foreground">AI retrieves real AMLR 2024/1624 regulatory text via RAG, then maps Articles 9–15 to this role's training obligations.</p></div></div></div>
      {error && <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-4 w-4" /> {error}</div>}
      {warnings.length > 0 && <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="py-3 space-y-1">{warnings.map((w,i)=><p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> {w}</p>)}</CardContent></Card>}

      {!hasMappings && (
        <Card className="mb-8 border-dashed border-2 shadow-none hover:border-primary/30 transition-colors">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">Run AMLR Article Mapping</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">RAG retrieves real AMLR 2024/1624 regulation text (Articles 9–15), then the AI determines which articles impose training obligations on this role — with verified citations.</p>
            <Button size="lg" onClick={mapAMLR} disabled={mapping} className="gap-2">{mapping ? <><Loader2 className="h-4 w-4 animate-spin" /> Mapping Articles…</> : <><Sparkles className="h-4 w-4" /> Run AMLR Article Mapping</>}</Button>
          </CardContent>
        </Card>
      )}

      {hasMappings && (
        <>
          <div className="space-y-4 mb-6">
            {editMappings.map((m, idx) => (
              <Card key={idx} className="shadow-sm hover:shadow-md transition-shadow duration-200 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">{m.article.replace('Article ', '')}</span>
                      <div className="flex-1 min-w-0">
                        <Input value={m.article_name} onChange={e => updateMapping(idx, 'article_name', e.target.value)} className="h-8 text-sm font-semibold border-none bg-transparent px-0 mb-1" placeholder="Article title…" />
                        <p className="text-xs text-muted-foreground">{m.article}</p>
                      </div>
                    </div>
                    <button onClick={() => removeMapping(idx)} className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors mt-1 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4 space-y-3">
                  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-1 flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Applies because</p>
                    <Input value={m.applies_because} onChange={e => updateMapping(idx, 'applies_because', e.target.value)} className="h-8 text-sm border-none bg-transparent px-0 text-blue-800 dark:text-blue-300" placeholder="Why this article applies to this role…" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Training Obligation</p>
                    <Input value={m.training_obligation} onChange={e => updateMapping(idx, 'training_obligation', e.target.value)} className="h-8 text-sm" placeholder="What this role must be trained on…" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="lg" onClick={addMapping}><Plus className="h-4 w-4 mr-1" /> Add Article</Button>
            <Button variant="outline" size="lg" onClick={saveMappings} disabled={saving}>Save Mapping</Button>
            <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/plan`)} className="gap-2">Continue to Training Plan <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
