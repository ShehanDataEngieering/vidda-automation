import { useEffect, useRef, useState } from 'react';
import { Cpu, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import type { SseEvent } from '../types';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ModuleCard {
  moduleId: string; regulation: string; role: string; content: string;
  qualityScore?: number; citationGrounded?: boolean; warnings?: string[]; done: boolean;
}
interface Props { companyId: string; onComplete: () => void; }

export default function Generation({ companyId, onComplete }: Props) {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [stageMsg, setStageMsg] = useState('Starting pipeline…');
  const [modules, setModules] = useState<ModuleCard[]>([]);
  const [complete, setComplete] = useState(false);
  const [totalModules, setTotalModules] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let closed = false;
    async function run() {
      try {
        const res = await apiRef.current('/api/generate', {
          method: 'POST',
          body: JSON.stringify({ companyId }),
        });
        if (!res.ok || !res.body) { setError('Failed to start generation.'); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const ev = JSON.parse(line.slice(6)) as SseEvent;
            if (ev.type === 'stage') setStageMsg(ev.message);
            if (ev.type === 'module_start') setModules(prev => [...prev, { moduleId: ev.moduleId, regulation: ev.regulation, role: ev.role, content: '', done: false }]);
            if (ev.type === 'chunk') setModules(prev => prev.map(m => m.moduleId === ev.moduleId ? { ...m, content: m.content + ev.content } : m));
            if (ev.type === 'module_done') setModules(prev => prev.map(m => m.moduleId === ev.moduleId ? { ...m, done: true, qualityScore: ev.qualityScore, citationGrounded: ev.citationGrounded, warnings: ev.warnings } : m));
            if (ev.type === 'complete') { setComplete(true); setTotalModules(ev.totalModules); }
            if (ev.type === 'error') setError(ev.message);
          }
        }
      } catch { if (!closed) setError('Connection error. Is the backend running?'); }
    }
    run();
    return () => { closed = true; };
  }, [companyId]);

  const done = modules.filter(m => m.done).length;
  const pct = modules.length > 0 ? Math.round((done / modules.length) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Cpu className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Generating Modules</h1>
          <p className="text-sm text-muted-foreground">AI pipeline running — do not close this page</p>
        </div>
      </div>

      {/* Status card */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-3">{stageMsg}</p>
          {modules.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{done} / {modules.length} modules ({pct}%)</span>
              </div>
              <Progress value={pct} />
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {complete && modules.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 text-sm mb-4">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          No compliance gaps detected — all scores are above threshold.
        </div>
      )}

      {/* Module cards */}
      <div className="space-y-3">
        {modules.map(mod => (
          <Card key={mod.moduleId}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{mod.regulation}</CardTitle>
                  <span className="text-xs text-muted-foreground">— {mod.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {mod.done && mod.qualityScore !== undefined && (
                    <Badge variant={mod.qualityScore >= 70 ? 'success' : 'warning'}>
                      {mod.qualityScore}%
                    </Badge>
                  )}
                  {mod.done ? (
                    <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>
                  ) : (
                    <Badge variant="secondary"><span className="animate-pulse">Generating…</span></Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {mod.warnings && mod.warnings.length > 0 && (
              <div className="mx-4 mb-2 px-3 py-1.5 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-400">
                {mod.warnings.join(' · ')}
              </div>
            )}
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-40">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {mod.content}{!mod.done && <span className="animate-pulse text-primary">▌</span>}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      {complete && totalModules > 0 && (
        <div className="mt-6">
          <Button onClick={onComplete}>
            Go to Review <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
