import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen, Loader2, AlertTriangle, ChevronRight, Plus, Trash2,
  Sparkles, Lightbulb, Filter, FileDown, RotateCcw, X
} from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan, AMLRMapping } from '../types-v6';

const ARTICLE_CATEGORIES: Record<string, string> = {
  'Article 9':  'Customer Due Diligence',
  'Article 10': 'Beneficial Ownership',
  'Article 11': 'Enhanced Due Diligence',
  'Article 12': 'Situations requiring EDD',
  'Article 13': 'Simplified Due Diligence',
  'Article 14': 'Record Keeping',
  'Article 15': 'Internal Controls / Policies',
};

/* ── Enforcement risk tier (arbitrary mapping for display) ── */
function enforcementTier(article: string): 'High' | 'Medium' | 'Low' {
  const high = ['Article 9', 'Article 11', 'Article 12'];
  const med = ['Article 10', 'Article 14'];
  if (high.includes(article)) return 'High';
  if (med.includes(article)) return 'Medium';
  return 'Low';
}

function tierBadge(article: string) {
  const t = enforcementTier(article);
  const map = {
    High:   { color: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800' },
    Medium: { color: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' },
    Low:    { color: 'text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 border-teal-200 dark:border-teal-800' },
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${map[t].color}`}>
      {t} enforcement
    </Badge>
  );
}

/* ── Export to simple text/pdf representation ── */
function exportMappingsToText(plan: PipelinePlan, mappings: AMLRMapping[]): string {
  const role = plan.role_title ?? 'Unknown Role';
  const date = new Date().toLocaleDateString();
  let out = `AMLR 2024/1624 ARTICLE MAPPING\n`;
  out += `Role: ${role}\nGenerated: ${date}\n`;
  out += `${'='.repeat(50)}\n\n`;
  mappings.forEach((m, i) => {
    out += `${i + 1}. ${m.article} — ${m.article_name}\n`;
    out += `   Applies because: ${m.applies_because}\n`;
    out += `   Training obligation: ${m.training_obligation}\n\n`;
  });
  return out;
}

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

export default function AMLRMappingScreen() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();

  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEnforcement, setFilterEnforcement] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [editMappings, setEditMappings] = useState<AMLRMapping[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadPlan() {
    if (!planId) return;
    setLoading(true);
    const res = await api(`/api/pipeline/${planId}`);
    if (res.ok) {
      const d = await res.json() as PipelinePlan;
      setPlan(d);
      if (d.amlr_mappings) setEditMappings([...d.amlr_mappings]);
    }
    setLoading(false);
  }

  useEffect(() => { void loadPlan(); }, [planId]);

  async function mapAMLR() {
    if (!planId) return;
    setMapping(true); setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/map-amlr`, { method: 'POST' });
      if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'Failed'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, amlr_mappings: data.amlrMappings, current_step: 'amlr' } : prev);
      setEditMappings(data.amlrMappings as AMLRMapping[]);
      setWarnings(data.warnings ?? []);
    } catch { setError('Connection error'); }
    finally { setMapping(false); }
  }

  async function saveMappings() {
    if (!planId) return;
    setSaving(true);
    try {
      await api(`/api/pipeline/${planId}/amlr`, {
        method: 'PATCH',
        body: JSON.stringify({ mappings: editMappings, reviewerNote: 'Legal review — mapping confirmed.' }),
      });
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  }

  function regenerateAMLR() {
    if (!confirm('Regenerating will replace all current mappings with AI-generated ones. Continue?')) return;
    setMapping(true); setError('');
    api(`/api/pipeline/${planId}/regenerate-amlr`, { method: 'POST' })
      .then(async res => {
        if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'Failed'); return; }
        const data = await res.json();
        setPlan(prev => prev ? { ...prev, amlr_mappings: data.amlrMappings, current_step: 'amlr' } : prev);
        setEditMappings(data.amlrMappings as AMLRMapping[]);
      })
      .catch(() => setError('Connection error'))
      .finally(() => setMapping(false));
  }

  function addMapping() {
    setEditMappings(prev => [...prev, { article: 'Article 9', article_name: '', applies_because: '', training_obligation: '' }]);
  }
  function removeMapping(idx: number) { setEditMappings(prev => prev.filter((_, i) => i !== idx)); }
  function updateMapping(idx: number, field: keyof AMLRMapping, value: string) {
    setEditMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  // Derived: filtered mappings
  const filteredMappings = useMemo(() => {
    return editMappings.filter(m => {
      if (filterCategory !== 'all') {
        const cat = ARTICLE_CATEGORIES[m.article] ?? '';
        if (!cat.toLowerCase().includes(filterCategory.toLowerCase())) return false;
      }
      if (filterEnforcement !== 'all') {
        if (enforcementTier(m.article) !== filterEnforcement) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return m.article.toLowerCase().includes(term)
          || m.article_name.toLowerCase().includes(term)
          || m.applies_because.toLowerCase().includes(term);
      }
      return true;
    });
  }, [editMappings, filterCategory, filterEnforcement, searchTerm]);

  const categories = ['all', ...new Set(Object.values(ARTICLE_CATEGORIES))];

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;

  if (!plan || !plan.risk_matrix) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6">
          <AlertTriangle className="h-5 w-5" /> Risk assessment not complete.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/risk`)}>Go to Risk Assessment</Button>
      </div>
    );
  }

  const hasMappings = editMappings.length > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="amlr" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
            <BookOpen className="h-5 w-5 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AMLR Article Mapping</h1>
            <p className="text-sm text-muted-foreground">RAG-verified AMLR 2024/1624 articles mapped to training obligations.</p>
          </div>
        </div>
        {hasMappings && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => {
                const blob = new Blob([exportMappingsToText(plan, editMappings)], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `AMLR-mapping-${plan.role_title ?? 'plan'}.txt`;
                a.click();
              }}>
              <FileDown className="h-3.5 w-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={regenerateAMLR} disabled={mapping}>
              <RotateCcw className="h-3.5 w-3.5" /> Regenerate
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

      {/* Run mapping CTA */}
      {!hasMappings && (
        <Card className="mb-8 border-dashed border-2 shadow-none">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-base font-semibold mb-2">Run AMLR Article Mapping</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              RAG retrieves real AMLR 2024/1624 regulation text (Articles 9–15), then the AI determines
              which articles impose training obligations on this role — with verified citations.
            </p>
            <Button size="lg" onClick={mapAMLR} disabled={mapping} className="gap-2">
              {mapping ? <><Loader2 className="h-4 w-4 animate-spin" /> Mapping…</> : <><Sparkles className="h-4 w-4" /> Run Mapping</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      {hasMappings && (
        <>
          <Card className="mb-4 shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-muted-foreground"><Filter className="h-3.5 w-3.5" /><span className="text-[10px] font-semibold uppercase tracking-wider">Filters</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <Button key={c} variant={filterCategory === c ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] px-2"
                      onClick={() => setFilterCategory(c === 'all' ? 'all' : c)}>
                      {c === 'all' ? 'All Categories' : c}
                    </Button>
                  ))}
                </div>
                <div className="h-4 w-px bg-border mx-1" />
                {(['High', 'Medium', 'Low'] as const).map(t => (
                  <Button key={t} variant={filterEnforcement === t ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] px-2"
                    onClick={() => setFilterEnforcement(filterEnforcement === t ? 'all' : t)}>
                    {t} Enforcement
                  </Button>
                ))}
                {(filterCategory !== 'all' || filterEnforcement !== 'all' || searchTerm) && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => { setFilterCategory('all'); setFilterEnforcement('all'); setSearchTerm(''); }}>
                    <X className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
                <div className="ml-auto">
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search articles…"
                    className="h-7 text-xs w-48" />
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground mb-2">{filteredMappings.length} of {editMappings.length} articles shown</p>

          {/* Mappings list */}
          <div className="space-y-4 mb-6">
            {filteredMappings.map((m, idx) => {
              const originalIdx = editMappings.indexOf(m);
              return (
                <Card key={idx} className="shadow-sm hover:shadow-md transition-shadow duration-200 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shrink-0 mt-0.5">
                          {m.article.replace('Article ', '')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Input value={m.article_name} onChange={e => updateMapping(originalIdx, 'article_name', e.target.value)}
                              className="h-8 text-sm font-semibold border-none bg-transparent px-0" placeholder="Article title…" />
                            {tierBadge(m.article)}
                          </div>
                          <p className="text-xs text-muted-foreground">{m.article} · {ARTICLE_CATEGORIES[m.article] ?? 'Other'}</p>
                        </div>
                      </div>
                      <button onClick={() => removeMapping(originalIdx)} className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors mt-1 opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 space-y-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-border text-sm leading-relaxed">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Lightbulb className="h-3 w-3" /> Applies because
                      </p>
                      <Input value={m.applies_because} onChange={e => updateMapping(originalIdx, 'applies_because', e.target.value)}
                        className="h-8 text-sm border-none bg-transparent px-0" placeholder="Why this article applies…" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Training Obligation</p>
                      <Input value={m.training_obligation} onChange={e => updateMapping(originalIdx, 'training_obligation', e.target.value)}
                        className="h-8 text-sm" placeholder="What this role must be trained on…" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="lg" onClick={addMapping}><Plus className="h-4 w-4 mr-1" /> Add Article</Button>
              <Button variant="outline" size="lg" onClick={saveMappings} disabled={saving}>{saving ? 'Saving…' : 'Save Mapping'}</Button>
            </div>
            <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/plan`)} className="gap-2">
              Continue to Training Plan <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
