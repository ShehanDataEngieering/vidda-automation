import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, AlertTriangle, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { PipelinePlan, AMLRMapping } from '../types-v6';

export default function AMLRMappingScreen() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();

  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Editable mappings for Gate 2
  const [editMappings, setEditMappings] = useState<AMLRMapping[]>([]);

  // Load plan
  async function loadPlan() {
    if (!planId) return;
    const res = await api(`/api/pipeline/${planId}`);
    if (!res.ok) { setError('Plan not found'); return; }
    const data = await res.json() as PipelinePlan;
    setPlan(data);
    if (data.amlr_mappings) {
      setEditMappings([...data.amlr_mappings]);
    }
    setLoading(false);
  }
  useEffect(() => { void loadPlan(); }, [planId]);

  // Step 4: Run AI AMLR mapping (with RAG)
  async function mapAMLR() {
    if (!planId) return;
    setMapping(true);
    setError('');
    try {
      const res = await api(`/api/pipeline/${planId}/map-amlr`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'AMLR mapping failed');
        return;
      }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, amlr_mappings: data.amlrMappings, current_step: 'amlr' } : prev);
      setEditMappings(data.amlrMappings as AMLRMapping[]);
      setWarnings(data.warnings ?? []);
    } catch {
      setError('Connection error');
    } finally { setMapping(false); }
  }

  // Gate 2: Save human-edited mappings
  async function saveMappings() {
    if (!planId) return;
    setSaving(true);
    try {
      const res = await api(`/api/pipeline/${planId}/amlr`, {
        method: 'PATCH',
        body: JSON.stringify({ mappings: editMappings, reviewerNote: 'Legal/compliance review — mapping confirmed.' }),
      });
      if (!res.ok) { setError('Failed to save'); return; }
      const data = await res.json();
      setPlan(prev => prev ? { ...prev, amlr_mappings: data.amlrMappings, version: data.version } : prev);
    } catch {
      setError('Connection error');
    } finally { setSaving(false); }
  }

  function addMapping() {
    setEditMappings(prev => [...prev, {
      article: 'Article 9',
      article_name: '',
      applies_because: '',
      training_obligation: '',
    }]);
  }

  function removeMapping(idx: number) {
    setEditMappings(prev => prev.filter((_, i) => i !== idx));
  }

  function updateMapping(idx: number, field: keyof AMLRMapping, value: string) {
    setEditMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  // Missing previous steps
  if (!plan || !plan.risk_matrix) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Risk assessment not complete. Complete Step 2 first.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/risk`)}>Go to Risk Assessment</Button>
      </div>
    );
  }

  const hasMappings = plan.amlr_mappings && plan.amlr_mappings.length > 0;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Step 3: AMLR Article Mapping</h1>
          <p className="text-sm text-muted-foreground">AI maps AMLR 2024/1624 Articles 9-15 to this role — verified against real regulation text via RAG.</p>
        </div>
      </div>

      {/* Run mapping button when no mappings yet */}
      {!hasMappings && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              The AI will retrieve real AMLR 2024/1624 regulatory text (Articles 9-15), then map which articles impose training obligations on this role.
            </p>
            <Button onClick={mapAMLR} disabled={mapping}>
              {mapping ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mapping AMLR Articles…</> : 'Run AMLR Article Mapping'}
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

      {/* AMLR Mapping Cards — Gate 2: editable */}
      {hasMappings && (
        <>
          <div className="space-y-3 mb-6">
            {editMappings.map((m, idx) => (
              <Card key={idx} className="border-blue-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">{m.article}</Badge>
                      <Input
                        value={m.article_name}
                        onChange={e => updateMapping(idx, 'article_name', e.target.value)}
                        className="h-7 text-sm font-medium border-none bg-transparent px-0 w-96"
                        placeholder="Article title…"
                      />
                    </div>
                    <button onClick={() => removeMapping(idx)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Applies because</p>
                    <Input
                      value={m.applies_because}
                      onChange={e => updateMapping(idx, 'applies_because', e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Why this article applies to this role…"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Training obligation</p>
                    <Input
                      value={m.training_obligation}
                      onChange={e => updateMapping(idx, 'training_obligation', e.target.value)}
                      className="h-8 text-xs"
                      placeholder="What this role must be trained on…"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Gate 2 controls */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-4 w-4 mr-1" /> Add Article
            </Button>
            <Button variant="outline" size="sm" onClick={saveMappings} disabled={saving}>
              Save Mapping
            </Button>
            <Button onClick={() => navigate(`/pipeline/${planId}/plan`)}>
              Continue to Training Plan <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
