import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, CheckCircle2, Clock, Circle } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { PipelinePlan } from '../types-v6';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-amber-100 text-amber-700',
  not_started: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  in_progress: Clock,
  not_started: Circle,
};

interface AssignmentRow {
  id: string;
  plan_id: string;
  user_id: string;
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

  async function loadData() {
    if (!planId) return;
    const [planRes, assignRes] = await Promise.all([
      api(`/api/pipeline/${planId}`),
      api(`/api/pipeline/${planId}/assignments`),
    ]);
    if (planRes.ok) setPlan(await planRes.json() as PipelinePlan);
    if (assignRes.ok) setAssignments(await assignRes.json() as AssignmentRow[]);
    setLoading(false);
  }
  useEffect(() => { void loadData(); }, [planId]);

  // Assign plan to employee (by Clerk userId currently — demo simplified)
  async function assignToEmployee() {
    if (!planId) return;
    setAssigning(true);
    setError('');
    try {
      // Demo: use email as userId proxy (in production you'd look up Clerk user)
      const res = await api(`/api/pipeline/${planId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userIds: [assignEmail], dueDate: dueDate || null }),
      });
      if (!res.ok) { setError('Failed to assign'); return; }
      setAssignEmail('');
      setDueDate('');
      void loadData(); // Refresh
    } catch { setError('Connection error'); }
    finally { setAssigning(false); }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!plan || plan.status !== 'approved') {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Plan not approved yet. Complete approval in the training plan step first.
        </div>
        <Button variant="outline" onClick={() => navigate(`/pipeline/${planId}/plan`)}>Go to Training Plan</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">LMS Assignment — {plan.role_title}</h1>
          <p className="text-sm text-muted-foreground">Assign this approved training plan to employees.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Assignment form */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <p className="text-xs text-muted-foreground">Employee Email / User ID</p>
              <Input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="employee@company.com" className="h-9" />
            </div>
            <div className="w-40 space-y-1.5">
              <p className="text-xs text-muted-foreground">Due Date</p>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
            </div>
            <Button onClick={assignToEmployee} disabled={assigning || !assignEmail.trim()}>
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignment table */}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No assignments yet. Assign this plan to an employee above.</p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assignments ({assignments.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Module</th>
                    <th className="py-2 px-3 font-medium">Q</th>
                    <th className="py-2 px-3 font-medium">Risk Dim</th>
                    <th className="py-2 px-3 font-medium">AMLR</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => {
                    const StatusIcon = STATUS_ICONS[a.status] ?? Circle;
                    return (
                      <tr key={a.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{a.module_name}</td>
                        <td className="py-2 px-3">{a.quarter}</td>
                        <td className="py-2 px-3">{a.risk_dimension}</td>
                        <td className="py-2 px-3">{a.amlr_article}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={STATUS_COLORS[a.status] ?? ''}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {a.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
