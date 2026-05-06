import { useEffect, useState } from 'react';
import { CheckSquare, ChevronRight, ChevronDown, XCircle, CheckCircle2 } from 'lucide-react';
import type { TrainingModule, SseEvent } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Props { companyId: string; onFinish: () => void; }

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
  if (status === 'rejected') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function ReviewDashboard({ companyId, onFinish }: Props) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [regenContent, setRegenContent] = useState<Record<string, string>>({});
  const [regenActive, setRegenActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function fetchModules() {
    const res = await fetch(`/api/modules/${companyId}`);
    if (res.ok) setModules(await res.json() as TrainingModule[]);
    setLoading(false);
  }
  useEffect(() => { void fetchModules(); }, [companyId]);

  async function approve(id: string) {
    await fetch(`/api/modules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approved', reviewer: 'Compliance Officer' }) });
    void fetchModules();
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    await fetch(`/api/modules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rejected', reviewer: 'Compliance Officer', comment: rejectReason }) });
    setRejectingId(null);
    void startRegen(id, rejectReason);
    setRejectReason('');
  }

  async function startRegen(id: string, reason: string) {
    setRegenActive(id);
    setRegenContent(prev => ({ ...prev, [id]: '' }));
    const res = await fetch(`/api/modules/${id}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const ev = JSON.parse(line.slice(6)) as SseEvent;
        if (ev.type === 'chunk') setRegenContent(prev => ({ ...prev, [id]: (prev[id] ?? '') + ev.content }));
        if (ev.type === 'complete') { setRegenActive(null); void fetchModules(); }
      }
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const stats = {
    total: modules.length,
    pending: modules.filter(m => m.status === 'pending').length,
    approved: modules.filter(m => m.status === 'approved').length,
    rejected: modules.filter(m => m.status === 'rejected').length,
  };
  const allApproved = stats.approved === stats.total && stats.total > 0;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Review Modules</h1>
            <p className="text-sm text-muted-foreground">Human review gate — EU AI Act Article 14</p>
          </div>
        </div>
        {allApproved && (
          <Button onClick={onFinish}>
            View Final Output <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, variant: 'outline' as const },
          { label: 'Pending', value: stats.pending, variant: 'warning' as const },
          { label: 'Approved', value: stats.approved, variant: 'success' as const },
          { label: 'Rejected', value: stats.rejected, variant: 'destructive' as const },
        ].map(s => (
          <Card key={s.label} className="text-center py-3">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Module list */}
      <div className="space-y-3">
        {modules.map(mod => (
          <Card key={mod.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-sm">{mod.regulation}</CardTitle>
                    <CardDescription className="text-xs">{mod.role}</CardDescription>
                  </div>
                  <StatusBadge status={mod.status} />
                  {mod.quality_score != null && (
                    <Badge variant={mod.quality_score >= 70 ? 'success' : 'warning'} className="text-xs">
                      {mod.quality_score}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {mod.status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 border-green-600/30 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => approve(mod.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setRejectingId(mod.id); setRejectReason(''); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}>
                    {expanded === mod.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expanded === mod.id && (
              <>
                <Separator />
                <CardContent className="pt-3">
                  <ScrollArea className="h-48">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {regenActive === mod.id ? regenContent[mod.id] : mod.content}
                      {regenActive === mod.id && <span className="animate-pulse text-primary">▌</span>}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </>
            )}

            {rejectingId === mod.id && (
              <>
                <Separator />
                <CardContent className="pt-3 bg-destructive/5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Rejection reason — will trigger AI regeneration:</p>
                  <Textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="e.g. Missing Article 13 reference for Front Office role"
                    className="text-xs min-h-[80px] mb-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => void reject(mod.id)} disabled={!rejectReason.trim()}>
                      Reject & Regenerate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>

      {allApproved && (
        <div className="mt-6">
          <Button onClick={onFinish}>
            View Final Output <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
