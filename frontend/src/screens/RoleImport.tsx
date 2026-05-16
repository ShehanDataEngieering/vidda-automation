import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { FileText, Loader2, Target, AlertTriangle, ChevronRight } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { RoleProfileV6 } from '../types-v6';
import { DEMO_ROLE_DESCRIPTION } from '../demo-script';

const ROLE_COLORS: Record<string, string> = {
  'Customer Advisor': 'bg-blue-100 text-blue-700 border-blue-200',
  'KYC Analyst': 'bg-teal-100 text-teal-700 border-teal-200',
  'TM Analyst': 'bg-purple-100 text-purple-700 border-purple-200',
  'AML DDI Manager': 'bg-amber-100 text-amber-700 border-amber-200',
  'MLRO': 'bg-red-100 text-red-700 border-red-200',
  'other': 'bg-gray-100 text-gray-700 border-gray-200',
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

  // Called when user clicks "Analyse Role"
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
    } catch {
      setError('Connection error. Is the backend running?');
    } finally {
      setAnalysing(false);
    }
  }

  // Ask user to create a plan first if no planId in URL
  async function createPlanAndGo() {
    const companyId = user?.publicMetadata?.companyId as string | undefined;
    if (!companyId) {
      setError('No company found. Create a company in Setup first.');
      return;
    }
    try {
      const res = await api('/api/pipeline', {
        method: 'POST',
        body: JSON.stringify({ companyId, createdBy: user?.id ?? 'unknown' }),
      });
      const data = await res.json();
      navigate(`/pipeline/${data.planId}`, { replace: true });
    } catch {
      setError('Failed to create plan');
    }
  }

  // Already have a planId — show the role import form
  if (planId) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Target className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Step 1: Role Import</h1>
            <p className="text-sm text-muted-foreground">Paste a role description to begin the AMLR compliance training pipeline.</p>
          </div>
        </div>

        {/* Demo helper — fills textarea with KYC Analyst from demo script */}
        {!roleProfile && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Role Description</CardTitle>
              <CardDescription>
                Paste any job role description. The AI will extract the profile and classify it against AMLR role archetypes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={roleDescription}
                onChange={e => setRoleDescription(e.target.value)}
                placeholder="Paste a role description here…"
                className="min-h-[200px] text-xs font-mono"
              />
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={analyseRole} disabled={analysing || !roleDescription.trim()}>
                  {analysing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</> : 'Analyse Role'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRoleDescription(DEMO_ROLE_DESCRIPTION)}>
                  Load Demo Role (KYC Analyst)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Role Profile Card — shown after AI analysis */}
        {roleProfile && (
          <>
            <Card className="mb-4 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-green-700 dark:text-green-400">
                    Role Analysis Complete
                  </CardTitle>
                  <Badge variant="outline" className={ROLE_COLORS[roleProfile.classified_as] ?? ROLE_COLORS.other}>
                    {roleProfile.classified_as}
                  </Badge>
                </div>
                <CardDescription className="text-green-700/70 dark:text-green-400/70">
                  AI confidence: {(roleProfile.classification_confidence * 100).toFixed(0)}%
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium uppercase tracking-wide">Role Title</p>
                    <p className="font-medium">{roleProfile.role_title}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium uppercase tracking-wide">Line of Defence</p>
                    <Badge variant="outline">{roleProfile.line_of_defence}</Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground font-medium uppercase tracking-wide">Daily Activities</p>
                    <p className="leading-relaxed">{roleProfile.daily_activities}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground font-medium uppercase tracking-wide">Key Decisions</p>
                    <p className="leading-relaxed">{roleProfile.key_decisions}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground font-medium uppercase tracking-wide">Mistake Consequences</p>
                    <p className="leading-relaxed text-destructive/80">{roleProfile.mistake_consequences}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

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

            <Button onClick={() => navigate(`/pipeline/${planId}/risk`)}>
              Continue to Risk Assessment <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  }

  // No planId — show create plan screen
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">New Training Plan</h1>
          <p className="text-sm text-muted-foreground">Create a new AMLR 2024/1624 compliance training plan.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-4">
            You will paste a job role description. The AI will extract the role profile,
            classify it against AMLR role archetypes, and guide you through the full pipeline:
            Risk Assessment → AMLR Article Mapping → Training Plan Generation → LMS Assignment.
          </p>
          <Button onClick={createPlanAndGo}>
            Start New Pipeline <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
