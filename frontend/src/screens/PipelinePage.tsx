import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import {
  Target, Plus, Users, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, ArrowRight, Calendar, BarChart3, Loader2
} from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PipelinePlan, PlanAssignment } from '../types-v6';

/* ==========================================================================
   PipelinePage — Professional Admin Dashboard
   Metrics, plans table, quick actions, activity feed
   ========================================================================== */

function MetricCard({
  label, value, sub, icon: Icon, trend
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  icon: React.ElementType;
  trend?: string | undefined;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </div>
          <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

export default function PipelinePage() {
  const navigate = useNavigate();
  const api = useApi();
  const { user } = useUser();
  const companyId = (user?.publicMetadata?.companyId as string | undefined) ?? '';

  const [plans, setPlans] = useState<PipelinePlan[]>([]);
  const [assignments, setAssignments] = useState<PlanAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      // 1. All plans for this company
      const plansRes = await api('/api/pipeline');
      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }
      // 2. All assignments across company plans
      const assignRes = await api('/api/pipeline/assignments/all');
      if (assignRes.ok) {
        setAssignments(await assignRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function createPlan() {
    if (!companyId) return;
    const res = await api('/api/pipeline', { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json() as { planId: string };
    if (!data.planId) return;
    navigate(`/pipeline/${data.planId}`);
  }

  const approved = plans.filter(p => p.status === 'approved');
  const inProgress = plans.filter(p =>
    p.status === 'draft' && p.current_step && p.current_step !== 'plan'
  );
  const completedModules = assignments.filter(a => a.status === 'completed').length;
  const completionRate = assignments.length
    ? Math.round((completedModules / assignments.length) * 100)
    : 0;

  return (
    <div className="p-6 max-w-6xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
            <Target className="h-5 w-5 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of AMLR compliance training pipelines.</p>
          </div>
        </div>
        <Button onClick={createPlan} disabled={!companyId} className="gap-2">
          <Plus className="h-4 w-4" /> New Pipeline
        </Button>
      </div>

      {companyId === '' && (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-medium">Company not configured.</p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 ml-6">
            Contact your administrator to complete onboarding.
          </p>
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Active Plans"
          value={String(plans.length)}
          sub={`${approved.length} approved · ${inProgress.length} in progress`}
          icon={Target}
          trend={plans.length > 0 ? `+${plans.length} this month` : undefined}
        />
        <MetricCard
          label="Training Modules"
          value={String(assignments.length)}
          sub={`Across ${plans.length} roles`}
          icon={Calendar}
        />
        <MetricCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${completedModules} of ${assignments.length} completed`}
          icon={BarChart3}
          trend={completionRate > 50 ? 'Above target' : undefined}
        />
        <MetricCard
          label="Team Members"
          value={String(new Set(assignments.map(a => a.user_id)).size)}
          sub="Assigned to training"
          icon={Users}
        />
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plans Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Training Plans</CardTitle>
              <CardDescription>All AMLR training plans for your company.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading plans…
                </div>
              ) : plans.length === 0 ? (
                <div className="py-12 text-center">
                  <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No plans yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Start your first AMLR training pipeline.</p>
                  <Button size="sm" onClick={createPlan} disabled={!companyId}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create Plan
                  </Button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 text-xs uppercase tracking-wider">Role</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 text-xs uppercase tracking-wider">Step</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 text-xs uppercase tracking-wider">Last Updated</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(plan => {
                      const stepLabel: Record<string, string> = {
                        created: 'Created', role: 'Role Import',
                        risk: 'Risk Assessment', amlr: 'AMLR Mapping',
                        plan: 'Plan Review', lms: 'LMS Assigned',
                      };
                      return (
                        <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-medium">{plan.role_title ?? 'Untitled Plan'}</p>
                            <p className="text-xs text-muted-foreground">{plan.line_of_defence ?? '—'}</p>
                          </td>
                          <td className="px-6 py-3">
                            {plan.status === 'approved' ? (
                              <Badge variant="success" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Draft</Badge>
                            )}
                          </td>
                          <td className="px-6 py-3"><span className="text-xs text-muted-foreground">{stepLabel[plan.current_step] ?? plan.current_step}</span></td>
                          <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(plan.updated_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/pipeline/${plan.id}`)}>
                              Open <ArrowRight className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel — Quick Actions & Coverage */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm gap-2 h-9" onClick={() => navigate('/pipeline/new')} disabled={!companyId}>
                <Plus className="h-3.5 w-3.5" /> New Training Plan
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm gap-2 h-9" onClick={() => navigate('/users')}>
                <Users className="h-3.5 w-3.5" /> Manage Team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Coverage Overview</CardTitle>
              <CardDescription className="text-xs">AMLR article coverage for active plans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {['Article 9', 'Article 10', 'Article 11', 'Article 12', 'Article 13'].map(article => {
                const covered = plans.some(p =>
                  p.amlr_mappings?.some(m => m.article === article)
                );
                return (
                  <div key={article} className="flex items-center justify-between">
                    <span className="text-xs font-medium">{article}</span>
                    {covered ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Covered</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Not mapped</Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.filter(a => a.status !== 'completed').length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No pending deadlines.</p>
              ) : (
                <div className="space-y-2">
                  {assignments
                    .filter(a => a.status !== 'completed')
                    .slice(0, 4)
                    .map(a => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <span>{a.quarter}</span>
                        <Badge variant={a.status === 'in_progress' ? 'default' : 'secondary'} className="text-[10px]">
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
