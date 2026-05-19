import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Clock, AlertTriangle, Info } from 'lucide-react';
import { useApi } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface AssignmentRow {
  id: string;
  plan_id: string;
  module_index: number;
  quarter: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  role_title: string;
  module_name: string;
  risk_dimension: string;
  amlr_article: string;
  why_included: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-amber-100 text-amber-700',
  not_started: 'bg-gray-100 text-gray-500',
};

export default function LMSDashboard() {
  const api = useApi();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  async function loadPlan() {
    try {
      const res = await api('/api/training/my-plan');
      if (res.ok) setAssignments(await res.json() as AssignmentRow[]);
    } catch { setError('Failed to load training plan'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadPlan(); }, []);

  async function updateStatus(assignmentId: string, newStatus: string) {
    setUpdating(prev => new Set(prev).add(assignmentId));
    try {
      const res = await api(`/api/training/my-plan/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: data.status, completed_at: data.completed_at } : a));
      }
    } catch { /* ignore */ }
    finally { setUpdating(prev => { const s = new Set(prev); s.delete(assignmentId); return s; }); }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const completed = assignments.filter(a => a.status === 'completed').length;
  const pct = assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 0;
  const roleTitle = assignments[0]?.role_title ?? 'Your Role';

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
          <BookOpen className="h-5 w-5 text-white dark:text-slate-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Training Plan — {roleTitle}</h1>
          <p className="text-sm text-muted-foreground">AMLR 2024/1624 compliance training assigned to you.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Progress bar */}
      {assignments.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Overall Progress</p>
              <span className="text-sm font-bold">{pct}%</span>
            </div>
            <Progress value={pct} className="mb-2" />
            <p className="text-xs text-muted-foreground">{completed} of {assignments.length} modules completed</p>
          </CardContent>
        </Card>
      )}

      {/* By quarter */}
      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
        const qAssignments = assignments.filter(a => a.quarter === q);
        if (qAssignments.length === 0) return null;
        const qDone = qAssignments.filter(a => a.status === 'completed').length;

        return (
          <Card key={q} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{q} — {qDone}/{qAssignments.length} complete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {qAssignments.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2 px-3 rounded-md border text-xs">
                  <button
                    onClick={() => updateStatus(a.id, a.status === 'completed' ? 'in_progress' : 'completed')}
                    disabled={updating.has(a.id)}
                    className="shrink-0"
                  >
                    {a.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : a.status === 'in_progress' ? (
                      <Clock className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{a.module_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{a.risk_dimension}</Badge>
                      <Badge variant="outline" className="text-[10px]">{a.amlr_article}</Badge>
                      {a.due_date && <span className="text-muted-foreground">Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                    </div>
                    {a.why_included && (
                      <p className="flex items-start gap-1 mt-1 text-[11px] text-blue-600 dark:text-blue-400 leading-snug">
                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                        {a.why_included}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[a.status] ?? ''}>
                    {a.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {assignments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          No training modules assigned yet. Your compliance manager will assign your AMLR training plan.
        </p>
      )}
    </div>
  );
}
