import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, CheckCircle2, Clock, Circle, Info, type LucideIcon } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PipelineStepper, PIPELINE_STEPS } from '../components/PipelineStepper';
import type { PipelinePlan } from '../types-v6';

const STATUS_MAP: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Completed' },
  in_progress: { icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', label: 'In Progress' },
  not_started: { icon: Circle, color: 'bg-muted text-muted-foreground', label: 'Not Started' },
};

interface AssignmentRow { id: string; plan_id: string; user_id: string; module_index: number; quarter: string; due_date: string | null; status: string; completed_at: string | null; role_title: string; module_name: string; risk_dimension: string; amlr_article: string; why_included: string; }

export default function LMSView() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [plan, setPlan] = useState<PipelinePlan | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignEmail, setAssignEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  async function loadData() { if (!planId) return; const [pr, ar] = await Promise.all([api(`/api/pipeline/${planId}`), api(`/api/pipeline/${planId}/assignments`)]); if (pr.ok) setPlan(await pr.json() as PipelinePlan); if (ar.ok) setAssignments(await ar.json() as AssignmentRow[]); setLoading(false); }
  useEffect(() => { void loadData(); }, [planId]);

  async function assignToEmployee() { if (!planId) return; setAssigning(true); try { const res = await api(`/api/pipeline/${planId}/assign`, { method: 'POST', body: JSON.stringify({ userIds: [assignEmail], dueDate: dueDate || null }) }); if (!res.ok) setError('Failed to assign'); else { setAssignEmail(''); setDueDate(''); void loadData(); } } catch { setError('Connection error'); } finally { setAssigning(false); } }

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (!plan || plan.status !== 'approved') {
    return (<div className="p-8 max-w-2xl mx-auto"><div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-5 w-5" /> Plan not approved yet.</div><Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/plan`)}>Go to Training Plan</Button></div>);
  }

  const completed = assignments.filter(a => a.status === 'completed').length;
  const pct = assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      <PipelineStepper steps={PIPELINE_STEPS} currentStep="lms" onNavigate={(path) => navigate(`/pipeline/${planId}${path}`)} />
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
            <Users className="h-5 w-5 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">LMS Assignment — {plan.role_title}</h1>
            <p className="text-sm text-muted-foreground">Assign training plans to employees with due dates.</p>
          </div>
        </div>
      </div>
      {error && <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm mb-6"><AlertTriangle className="h-4 w-4" /> {error}</div>}

      {assignments.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{pct}%</p><p className="text-xs text-muted-foreground mt-1">Completion</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{completed}</p><p className="text-xs text-muted-foreground mt-1">Completed</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{assignments.length - completed}</p><p className="text-xs text-muted-foreground mt-1">Remaining</p></CardContent></Card>
        </div>
      )}

      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-4 pb-4"><div className="flex items-end gap-3"><div className="flex-1 space-y-1.5"><p className="text-xs text-muted-foreground">Employee Email / User ID</p><Input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="employee@vidda.dev" className="h-9" /></div><div className="w-40 space-y-1.5"><p className="text-xs text-muted-foreground">Due Date</p><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" /></div><Button onClick={assignToEmployee} disabled={assigning || !assignEmail.trim()} className="gap-1">Assign</Button></div></CardContent>
      </Card>

      {assignments.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No assignments yet. Enter an employee email above to assign this training plan.</p>}

      {assignments.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50 text-left"><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Module &amp; Rationale</th><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-12">Q</th><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Risk Dim</th><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">AMLR</th><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th><th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-28">Due</th></tr></thead><tbody>
            {assignments.map(a => { const s = STATUS_MAP[a.status] ?? STATUS_MAP.not_started!; const Icon = s.icon; return (
              <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <p className="font-medium leading-tight">{a.module_name}</p>
                  {a.why_included && (
                    <p className="flex items-start gap-1 mt-1 text-[11px] text-blue-600 dark:text-blue-400 leading-snug max-w-sm">
                      <Info className="h-3 w-3 shrink-0 mt-0.5" />
                      {a.why_included}
                    </p>
                  )}
                </td>
                <td className="py-3 px-4 text-muted-foreground">{a.quarter}</td>
                <td className="py-3 px-4"><Badge variant="outline" className="text-[10px]">{a.risk_dimension}</Badge></td>
                <td className="py-3 px-4"><Badge variant="outline" className="text-[10px]">{a.amlr_article}</Badge></td>
                <td className="py-3 px-4"><Badge className={`text-[10px] ${s.color}`}><Icon className="h-3 w-3 mr-1" />{s.label}</Badge></td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</td>
              </tr>
            );})}
          </tbody></table></div>
        </Card>
      )}
    </div>
  );
}
