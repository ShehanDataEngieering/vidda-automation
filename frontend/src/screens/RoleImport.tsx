import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Loader2, Target, AlertTriangle, Sparkles,
  CheckCircle2, RotateCw, HelpCircle, Globe, Monitor, ShieldCheck,
  Upload, Building2, X, ArrowRight
} from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { RoleProfileV6 } from '../types-v6';
import { DEMO_ROLE_DESCRIPTION } from '../demo-script';

const ROLE_COLORS: Record<string, string> = {
  'Customer Advisor': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  'KYC Analyst':    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300',
  'TM Analyst':     'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
  'AML DDI Manager':'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  'MLRO':           'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  'other':          'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400',
};

/* ── Generated questions based on role classification ── */
function getClarificationQuestions(roleClass: string): string[] {
  const base = [
    'Which regulatory jurisdictions does this role primarily operate in?',
    'What internal systems or platforms does this role interact with daily?',
    'Describe the escalation path when suspicious activity is detected.',
  ];
  const extended: Record<string, string[]> = {
    'KYC Analyst': ['Does this role handle PEPs or sanctioned entities directly?', 'What Source of Funds / Source of Wealth verification tools are used?'],
    'TM Analyst': ['Which transaction monitoring system is used (e.g., Actimize, FICO)?', 'What thresholds trigger SAR filing obligations?'],
    'MLRO': ['What regulatory reporting channels are used (e.g., FIU, FCA)?', 'How often are board-level AML reports presented?'],
    'AML DDI Manager': ['How many FTEs are in the AML team?', 'What is the current regulatory audit cycle?'],
    'Customer Advisor': ['Are there face-to-face verification requirements?', 'What high-risk product types are sold?'],
  };
  return [...base, ...(extended[roleClass] ?? [])];
}

/* ========================================================================== */

export default function RoleImport() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Form state ──
  const [roleTitle, setRoleTitle] = useState('');
  const [geography, setGeography] = useState('EU');
  const [regulatoryScope, setRegulatoryScope] = useState<string[]>(['AMLR']);
  const [roleDescription, setRoleDescription] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [roleProfile, setRoleProfile] = useState<RoleProfileV6 | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');

  // ── Clarification layer ──
  const [showClarify, setShowClarify] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Batch state ──
  const [showBatch, setShowBatch] = useState(false);
  const [batchRoles, setBatchRoles] = useState<{ title: string; description: string }[]>([]);

  const REGS = ['AMLR'];

  async function analyseRole() {
    if (!roleDescription.trim() || !planId) return;
    setAnalysing(true);
    setError(''); setWarnings([]); setRoleProfile(null);
    try {
      const res = await api(`/api/pipeline/${planId}/analyze-role`, {
        method: 'POST',
        body: JSON.stringify({
          roleDescription: enrichedDescription(),
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Analysis failed'); return; }
      const data = await res.json();
      setRoleProfile(data.roleProfile as RoleProfileV6);
      setWarnings(data.warnings ?? []);
      setShowClarify(true);
      // Pre-fill empty answers
      const questions = getClarificationQuestions(data.roleProfile.classified_as ?? 'other');
      const blank: Record<string, string> = {};
      questions.forEach(q => { blank[q] = ''; });
      setAnswers(blank);
    } catch { setError('Connection error'); }
    finally { setAnalysing(false); }
  }

  function enrichedDescription(): string {
    let text = roleDescription.trim();
    if (roleTitle) text = `TITLE: ${roleTitle}\nGEOGRAPHY: ${geography}\nREGULATORY SCOPE: ${regulatoryScope.join(', ')}\n\n` + text;
    // Append clarification answers if they exist
    const answered = Object.entries(answers).filter(([, v]) => v.trim());
    if (answered.length) {
      text += '\n\n[CLARIFICATIONS]\n' + answered.map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n');
    }
    return text;
  }

  async function saveAndContinue() {
    if (!planId) return;
    setSaving(true);
    try {
      // Patch plan with clarifications appended to role_description
      await api(`/api/pipeline/${planId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({
          roleDescription: enrichedDescription(),
          roleProfile: { ...roleProfile, clarifications: answers } as unknown as RoleProfileV6,
        }),
      });
      navigate(`/pipeline/${planId}/risk`);
    } catch { setError('Failed to save clarifications'); }
    finally { setSaving(false); }
  }

  async function createPlanAndGo() {
    const res = await api('/api/pipeline', { method: 'POST' });
    if (!res.ok) { setError('Failed to create plan'); return; }
    const data = await res.json() as { planId: string };
    navigate(`/pipeline/${data.planId}`, { replace: true });
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Only .csv or .txt files'); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setError('CSV needs header + 1 row'); return; }
      const rows = lines.slice(1).map(line => {
        const [title, desc] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return { title: title || 'Untitled', description: desc || '' };
      }).filter(r => r.description);
      setBatchRoles(rows);
    };
    reader.readAsText(file);
  }

  const certaintyPct = roleProfile ? Math.round(roleProfile.classification_confidence * 100) : 0;

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // Landing screen (no planId)
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  if (!planId) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 mx-auto mb-4">
            <Target className="h-7 w-7 text-white dark:text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">AMLR Training Pipeline</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            AI analyses a role description, scores risk dimensions, maps AMLR articles, and generates
            a 4-quarter compliance training plan with full audit trail.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-8 pb-6 space-y-6">
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: 'Import',    icon: FileText,    color: 'text-slate-600' },
                { label: 'Risk',      icon: ShieldCheck, color: 'text-slate-600' },
                { label: 'AMLR',      icon: Building2,   color: 'text-slate-600' },
                { label: 'Plan',      icon: Globe,       color: 'text-slate-600' },
                { label: 'LMS',       icon: Monitor,     color: 'text-slate-600' },
              ].map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button size="lg" onClick={createPlanAndGo} className="gap-2">
                Start New Pipeline <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowBatch(s => !s)}>
                <Upload className="h-4 w-4 mr-1.5" /> Batch Import
              </Button>
            </div>
          </CardContent>
        </Card>

        {showBatch && (
          <Card className="mt-4 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Batch Import</CardTitle>
              <CardDescription className="text-xs">Upload a CSV with columns: title, description</CardDescription>
            </CardHeader>
            <CardContent>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Choose File
              </Button>
              {batchRoles.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{batchRoles.length} roles detected</p>
                  {batchRoles.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <span className="font-medium">{r.title}</span>
                      <span className="text-muted-foreground truncate max-w-[300px]">{r.description.slice(0, 60)}…</span>
                    </div>
                  ))}
                  <Button size="sm" className="mt-2" onClick={async () => {
                    // Create plan for first role only for now
                    if (!batchRoles[0]) return;
                    const res = await api('/api/pipeline', { method: 'POST' });
    if (!res.ok) { setError('Failed to create plan'); return; }
    const data = await res.json() as { planId: string };
                    setRoleTitle(batchRoles[0].title);
                    setRoleDescription(batchRoles[0].description);
                    navigate(`/pipeline/${data.planId}`);
                  }}>
                    Process First Role
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </div>
    );
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // Active pipeline screen
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="role" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
          <Target className="h-5 w-5 text-white dark:text-slate-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Role Import &amp; Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Define the role. AI extracts profiles and classifies against AMLR archetypes.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Input Form (only before analysis) ── */}
      {!roleProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: metadata */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Role Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role Title (optional)</label>
                  <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="e.g. KYC Analyst" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geography</label>
                  <div className="flex gap-2">
                    {['EU', 'UK', 'US', 'Global'].map(g => (
                      <Button key={g} variant={geography === g ? 'default' : 'outline'} size="sm"
                        className="text-xs h-7 flex-1" onClick={() => setGeography(g)}>
                        {g}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regulatory Scope</label>
                  <div className="flex flex-wrap gap-1.5">
                    {REGS.map(r => (
                      <Badge key={r} variant={regulatoryScope.includes(r) ? 'default' : 'outline'}
                        className="cursor-pointer text-[10px] px-2.5 py-0.5"
                        onClick={() => setRegulatoryScope(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}>
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Tips for best results</p>
                    <p>Paste a detailed job description including daily tasks, key decisions, and consequences of mistakes.</p>
                    <p>Include regulatory frameworks the role touches.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main: description */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Role Description
                </CardTitle>
                <CardDescription className="text-xs">
                  Paste a role description, job posting, or internal document. AI extracts structured profile data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={roleDescription}
                  onChange={e => setRoleDescription(e.target.value)}
                  placeholder="Paste role description here…"
                  className="min-h-[260px] text-sm leading-relaxed"
                />
                <div className="flex items-center gap-3">
                  <Button onClick={analyseRole} disabled={analysing || !roleDescription.trim()} className="gap-2">
                    {analysing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                      : <><Sparkles className="h-4 w-4" /> Analyse Role</>}
                  </Button>
                  <Button variant="outline" onClick={() => setRoleDescription(DEMO_ROLE_DESCRIPTION)}>
                    Load Example
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setRoleDescription(''); setRoleTitle(''); }} className="text-muted-foreground">
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Analysis Loading State ── */}
      {analysing && (
        <Card className="mt-6 border-primary/20 bg-primary/[0.03]">
          <CardContent className="py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm font-medium">Analysing role with AI…</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Extracting profile → classifying against AMLR archetypes → generating consequence analysis
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Analysis Result ── */}
      {roleProfile && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Profile Card */}
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">Role Analysis Complete</CardTitle>
                </div>
                <Badge className={`${ROLE_COLORS[roleProfile.classified_as] ?? ROLE_COLORS.other} text-xs px-2.5 py-0.5`}>
                  {roleProfile.classified_as}
                </Badge>
              </div>
              <div className="flex items-center gap-6 mt-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-base font-bold text-slate-700 dark:text-slate-300">{certaintyPct}%</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
                    <p className="text-xs text-muted-foreground">{certaintyPct >= 80 ? 'High match' : 'Moderate match'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{roleProfile.line_of_defence}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Role Title</p>
                  <p className="font-semibold">{roleProfile.role_title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Line of Defence</p>
                  <Badge variant="outline" className="text-xs">{roleProfile.line_of_defence}</Badge>
                </div>
              </div>
              <div className="space-y-3 pt-3 border-t">
                {[
                  { label: 'Daily Activities', value: roleProfile.daily_activities, icon: Monitor },
                  { label: 'Key Decisions', value: roleProfile.key_decisions, icon: ShieldCheck },
                  { label: 'Mistake Consequences', value: roleProfile.mistake_consequences, icon: AlertTriangle, destructive: true },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                    </div>
                    <p className={`text-sm leading-relaxed ${item.destructive ? 'text-red-600/90 dark:text-red-400/90' : 'text-muted-foreground'}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Clarification Layer ── */}
          {showClarify && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">AI Clarification</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Answer these questions to improve risk scoring accuracy. Based on your input, the AI will refine the profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {getClarificationQuestions(roleProfile.classified_as).map((q, i) => (
                  <div key={i} className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-primary/10 text-[10px] font-bold text-primary flex items-center justify-center">{i + 1}</span>
                      {q}
                    </label>
                    <Textarea
                      value={answers[q] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                      placeholder="Your answer…"
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={saveAndContinue} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Continue with Clarifications
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/risk`)}>
                    Skip to Risk Assessment
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setRoleProfile(null); setShowClarify(false); }} className="gap-1 text-muted-foreground">
                    <RotateCw className="h-3.5 w-3.5" /> Re-analyse
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {warnings.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
