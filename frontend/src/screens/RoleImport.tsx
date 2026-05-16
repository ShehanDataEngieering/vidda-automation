import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { FileText, Loader2, Target, AlertTriangle, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { RoleProfileV6 } from '../types-v6';
import { DEMO_ROLE_DESCRIPTION } from '../demo-script';

const ROLE_COLORS: Record<string, string> = {
  'Customer Advisor': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  'KYC Analyst': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300',
  'TM Analyst': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  'AML DDI Manager': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  'MLRO': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  'other': 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400',
};

const CLASSIFICATION_ICONS: Record<string, string> = {
  'Customer Advisor': '👥',
  'KYC Analyst': '🔍',
  'TM Analyst': '📊',
  'AML DDI Manager': '📋',
  'MLRO': '🏛️',
  'other': '📄',
};

export default function RoleImport() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const api = useApi();

  const [roleDescription, setRoleDescription] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [roleProfile, setRoleProfile] = useState<RoleProfileV6 | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function analyseRole() {
    if (!roleDescription.trim() || !planId) return;
    setAnalysing(true);
    setError('');
    setWarnings([]);
    try {
      const res = await api(`/api/pipeline/${planId}/analyze-role`, {
        method: 'POST',
        body: JSON.stringify({ roleDescription: roleDescription.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Analysis failed');
        return;
      }
      const data = await res.json();
      setRoleProfile(data.roleProfile as RoleProfileV6);
      setWarnings(data.warnings ?? []);
    } catch { setError('Connection error'); }
    finally { setAnalysing(false); }
  }

  async function createPlanAndGo() {
    const companyId = user?.publicMetadata?.companyId as string | undefined;
    if (!companyId) { setError('No company found. Create a company in Setup first.'); return; }
    try {
      const res = await api('/api/pipeline', {
        method: 'POST', body: JSON.stringify({ companyId, createdBy: user?.id ?? 'unknown' }),
      });
      const data = await res.json();
      navigate(`/pipeline/${data.planId}`, { replace: true });
    } catch { setError('Failed to create plan'); }
  }

  if (planId) {
    return (
      <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-300">
        <PipelineStepper steps={PIPELINE_STEPS} currentStep="role" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Role Import & Analysis</h1>
              <p className="text-sm text-muted-foreground">Paste a role description — AI extracts the profile and classifies against AMLR archetypes.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6 animate-in slide-in-from-top-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {!roleProfile && (
          <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Role Description
              </CardTitle>
              <CardDescription>Paste any job role description. The AI will extract the profile and classify it against 5 known AMLR role archetypes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={roleDescription}
                onChange={e => setRoleDescription(e.target.value)}
                placeholder="Paste a role description here…"
                className="min-h-[220px] text-xs font-mono leading-relaxed border-dashed focus:border-solid transition-colors"
              />
              <div className="flex items-center gap-2 mt-4">
                <Button onClick={analyseRole} disabled={analysing || !roleDescription.trim()} size="lg" className="gap-2">
                  {analysing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing with AI…</> : <><Sparkles className="h-4 w-4" /> Analyse Role</>}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setRoleDescription(DEMO_ROLE_DESCRIPTION)}>
                  Load Demo (KYC Analyst)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {analysing && (
          <Card className="mb-6 border-primary/30 bg-primary/5 animate-pulse">
            <CardContent className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm font-medium text-primary">AI is analysing the role description…</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting profile, classifying against AMLR archetypes, generating consequence analysis.</p>
            </CardContent>
          </Card>
        )}

        {roleProfile && (
          <>
            <Card className="mb-6 border-emerald-200 dark:border-emerald-800 shadow-sm animate-in zoom-in-95 duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" /> Role Analysis Complete
                  </CardTitle>
                  <Badge className={`${ROLE_COLORS[roleProfile.classified_as] ?? ROLE_COLORS.other} text-xs px-3 py-1`}>
                    {CLASSIFICATION_ICONS[roleProfile.classified_as] ?? '📄'} {roleProfile.classified_as}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{(roleProfile.classification_confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Confidence</p>
                      <p className="text-xs text-muted-foreground">{roleProfile.classification_confidence >= 0.8 ? 'High match' : 'Moderate match'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{roleProfile.line_of_defence}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Role Title</p>
                    <p className="font-semibold leading-snug">{roleProfile.role_title}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Line of Defence</p>
                    <Badge variant="outline" className="text-xs">{roleProfile.line_of_defence}</Badge>
                  </div>
                </div>
                <div className="space-y-3 pt-2 border-t">
                  {[
                    { label: 'Daily Activities', value: roleProfile.daily_activities },
                    { label: 'Key Decisions', value: roleProfile.key_decisions },
                    { label: 'Mistake Consequences', value: roleProfile.mistake_consequences, destructive: true },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                      <p className={`text-sm leading-relaxed ${item.destructive ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted-foreground'}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <Card className="mb-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="py-3 space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button size="lg" onClick={() => navigate(`/pipeline/${planId}/risk`)} className="gap-2">
              Continue to Risk Assessment <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto animate-in fade-in duration-300">
      <div className="text-center mb-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mx-auto mb-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">AMLR Training Plan Generator</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Generate role-specific, risk-based compliance training plans compliant with EU Regulation 2024/1624 (AMLR).
          The AI analyses a role description, scores 5 risk dimensions, maps AMLR articles, and produces a 4-quarter training plan.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              { label: 'Role Import', icon: '📥' },
              { label: 'Risk Matrix', icon: '🛡️' },
              { label: 'AMLR Map', icon: '📜' },
              { label: 'Training Plan', icon: '📅' },
              { label: 'LMS Assign', icon: '👥' },
            ].map((s, i) => (
              <div key={i} className="space-y-1">
                <span className="text-xl">{s.icon}</span>
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center pt-2">
            <Button size="lg" onClick={createPlanAndGo} className="gap-2">
              Start New Pipeline <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-4 mt-6 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
