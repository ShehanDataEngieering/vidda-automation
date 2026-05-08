import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { useApi } from '../utils/api';
import type { TrainingModuleWithProgress, TrainingProgress } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function TrainingDashboard() {
  const apiFetch = useApi();
  const [modules, setModules] = useState<TrainingModuleWithProgress[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  useEffect(() => {
    void Promise.all([apiFetch('/api/training/my-modules'), apiFetch('/api/training/my-progress')])
      .then(async ([modRes, progRes]) => {
        if (modRes.ok) setModules(await modRes.json() as TrainingModuleWithProgress[]);
        if (progRes.ok) setProgress(await progRes.json() as TrainingProgress);
      });
  }, []);

  async function markComplete(id: string) {
    setCompleting(prev => new Set(prev).add(id));
    const res = await apiFetch(`/api/training/my-modules/${id}/complete`, { method: 'POST' });
    if (res.ok) {
      const { completed_at } = await res.json() as { completed_at: string };
      setModules(prev => prev.map(m => m.id === id ? { ...m, completed_at } : m));
      setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : prev);
    }
    setCompleting(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  const filtered = modules.filter(m =>
    filter === 'all' ? true : filter === 'done' ? !!m.completed_at : !m.completed_at
  );

  const pct = progress && progress.total > 0 ? Math.round(progress.completed / progress.total * 100) : 0;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">My Training</h1>
          <p className="text-sm text-muted-foreground">Complete your assigned compliance modules.</p>
        </div>
      </div>

      {/* Progress overview */}
      {progress && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="col-span-2">
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Overall Progress</p>
                <span className="text-sm font-bold">{pct}%</span>
              </div>
              <Progress value={pct} className="mb-2" />
              <p className="text-xs text-muted-foreground">{progress.completed} of {progress.total} modules completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center h-full">
              <p className="text-3xl font-bold">{progress.total - progress.completed}</p>
              <p className="text-xs text-muted-foreground mt-1">Remaining</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By regulation */}
      {progress && progress.byRegulation.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">By Regulation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress.byRegulation.map(r => (
              <div key={r.regulation} className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted-foreground shrink-0">{r.regulation}</span>
                <div className="flex-1">
                  <Progress value={r.total > 0 ? (r.completed / r.total) * 100 : 0} className="h-1.5" />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{r.completed}/{r.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'done'] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Module list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No modules here.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <Card key={m.id}>
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.completed_at ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                  <CheckCircle2 className={`h-4 w-4 ${m.completed_at ? 'text-green-600' : 'text-muted-foreground/30'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{m.regulation}</p>
                    <Badge variant="outline" className="text-xs">{m.role}</Badge>
                    {m.quality_score != null && (
                      <Badge variant={m.quality_score >= 70 ? 'success' : 'warning'} className="text-xs">{m.quality_score}%</Badge>
                    )}
                  </div>
                  {m.completed_at ? (
                    <p className="text-xs text-green-600 mt-0.5">Completed {new Date(m.completed_at).toLocaleDateString()}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Not started</p>
                  )}
                </div>
                {!m.completed_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void markComplete(m.id)}
                    disabled={completing.has(m.id)}
                  >
                    {completing.has(m.id) ? 'Saving…' : 'Mark done'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

