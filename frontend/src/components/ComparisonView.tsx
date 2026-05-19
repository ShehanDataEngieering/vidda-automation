import { useState } from 'react';
import { BarChart3, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TrainingPlan } from '../types-v6';

/* ── Comparison row component ── */
function ComparisonRow({
  label,
  generic,
  ai,
  positive,
}: {
  label: string;
  generic: string;
  ai: string;
  positive?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr,1.2fr] gap-4 py-3 border-b last:border-0 text-sm">
      <div className="flex items-start gap-2 text-muted-foreground">
        <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p>{generic}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className={`h-4 w-4 ${positive ? 'text-emerald-500' : 'text-blue-500'} shrink-0 mt-0.5`} />
        <div>
          <p className="font-medium">{label}</p>
          <p>{ai}</p>
        </div>
      </div>
    </div>
  );
}

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

export default function ComparisonView({ aiPlan }: { aiPlan: TrainingPlan }) {
  const [show, setShow] = useState(false);

  const aiModules = aiPlan.quarters.reduce((sum, q) => sum + q.modules.length, 0);
  const aiHours = aiPlan.quarters.reduce(
    (sum, q) => sum + q.modules.reduce((s, m) => s + m.duration_hours, 0),
    0,
  );

  const uniqueArticles = new Set<string>();
  const uniqueDimensions = new Set<string>();
  for (const q of aiPlan.quarters) {
    for (const m of q.modules) {
      uniqueArticles.add(m.amlr_article);
      uniqueDimensions.add(m.risk_dimension);
    }
  }

  return (
    <div className="mb-6">
      <Button
        variant="outline"
        className="w-full justify-center gap-2 mb-4"
        onClick={() => setShow(s => !s)}
      >
        <BarChart3 className="h-4 w-4" />
        {show ? 'Hide Comparison' : 'Compare: Generic vs. Role-Specific'}
      </Button>

      {show && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ══ GENERIC (OLD WAY) ══ */}
          <Card className="border-dashed border-red-200 dark:border-red-900/40 opacity-70">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Generic Training (Before)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">1</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-red-500">Module</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">2h</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-red-500">Total</p>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">The One Module:</p>
                <Badge variant="secondary" className="text-xs">AML Awareness Training</Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  No article citations. No risk linkage. No role specificity.
                </p>
              </div>

              <ComparisonRow
                label="Why it exists"
                generic="Unknown — no explanation provided"
                ai="Every module cites AMLR article and risk dimension"
              />
              <ComparisonRow
                label="Regulatory basis"
                generic="None visible"
                ai={`${uniqueArticles.size} unique AMLR articles cited`}
              />
            </CardContent>
          </Card>

          {/* ══ AI PLAN (NEW WAY) ══ */}
          <Card className="border-emerald-200 dark:border-emerald-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Role-Specific Plan (After)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{aiModules}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">Modules</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{aiHours}h</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">Total</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{uniqueDimensions.size}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">Risks Covered</p>
                </div>
              </div>

              <ComparisonRow
                label="Risk coverage"
                generic="None — all roles get identical content"
                ai={`${uniqueDimensions.size} risk dimensions with targeted modules`}
                positive
              />
              <ComparisonRow
                label="Quarter structure"
                generic="Single annual session"
                ai="4-quarter progression: Foundation → Application → Deepening → Embedding"
                positive
              />
              <ComparisonRow
                label="Audit defensibility"
                generic="No justification, no version history"
                ai="Every module justifies why it exists; full version + reviewer trail"
                positive
              />
              <ComparisonRow
                label="Regulatory compliance"
                generic="Cannot prove role-specific training under AMLR Art 12"
                ai={`Cites ${uniqueArticles.size} AMLR articles with exact text grounding`}
                positive
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
