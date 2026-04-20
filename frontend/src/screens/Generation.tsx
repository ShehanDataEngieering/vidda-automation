import { useEffect, useRef, useState } from 'react';
import ProgressBar from '../components/ProgressBar';

interface ModuleCard {
  moduleId: string;
  regulation: string;
  role: string;
  content: string;
  qualityScore?: number;
  done: boolean;
}

interface Props {
  companyId: string;
}

const STAGES = ['Gap analysis', 'Vector search', 'Generating', 'Scoring'];

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

export default function Generation({ companyId }: Props) {
  const [stage, setStage] = useState(0);
  const [stageMsg, setStageMsg] = useState('Starting pipeline...');
  const [modules, setModules] = useState<ModuleCard[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const activeModuleId = useRef<string | null>(null);

  useEffect(() => {
    let closed = false;

    async function run() {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        });

        if (!res.ok || !res.body) {
          setError('Failed to start generation.');
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!closed) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.type === 'stage') {
              setStageMsg(event.message as string);
              setStage((s) => Math.min(s + 1, STAGES.length - 1));
            }

            if (event.type === 'gap_found') {
              setStage(1);
            }

            if (event.type === 'module_start') {
              const id = event.moduleId as string;
              activeModuleId.current = id;
              setStage(2);
              setModules((prev) => [
                ...prev,
                { moduleId: id, regulation: event.regulation as string, role: event.role as string, content: '', done: false },
              ]);
            }

            if (event.type === 'chunk' && activeModuleId.current) {
              const id = event.moduleId as string ?? activeModuleId.current;
              setModules((prev) =>
                prev.map((m) => m.moduleId === id ? { ...m, content: m.content + (event.content as string) } : m)
              );
            }

            if (event.type === 'module_done') {
              setStage(3);
              setModules((prev) =>
                prev.map((m) =>
                  m.moduleId === event.moduleId ? { ...m, done: true, qualityScore: event.qualityScore as number } : m
                )
              );
            }

            if (event.type === 'done') {
              setDone(true);
              setStage(STAGES.length - 1);
            }

            if (event.type === 'error') {
              setError(event.message as string);
            }
          }
        }
      } catch (e) {
        if (!closed) setError('Connection error. Is the backend running?');
      }
    }

    run();
    return () => { closed = true; };
  }, [companyId]);

  const completedCount = modules.filter((m) => m.done).length;

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          <span className="text-indigo-400">Vidda</span> Automation
        </h1>
        <p className="text-slate-400 text-sm">Generating compliance training modules</p>
      </div>

      {/* Pipeline stages */}
      <div className="bg-[#1E293B] rounded-xl p-5 mb-6">
        <div className="flex gap-2 mb-4">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < stage ? 'bg-indigo-600 text-white' :
                i === stage ? 'bg-indigo-500/30 text-indigo-300 ring-2 ring-indigo-500' :
                'bg-slate-700 text-slate-500'
              }`}>
                {i < stage ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i <= stage ? 'text-white' : 'text-slate-500'}`}>{s}</span>
              {i < STAGES.length - 1 && <div className="flex-1 h-px bg-slate-700" />}
            </div>
          ))}
        </div>
        <p className="text-slate-300 text-sm">{stageMsg}</p>
        {modules.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Modules generated</span>
              <span>{completedCount} / {modules.length}</span>
            </div>
            <ProgressBar value={completedCount} max={modules.length} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {done && modules.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-sm">
          ✅ No compliance gaps detected — all regulation scores are above 70.
        </div>
      )}

      {/* Module cards */}
      <div className="space-y-5">
        {modules.map((mod) => (
          <div key={mod.moduleId} className="bg-[#1E293B] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-indigo-400 font-semibold text-sm">{mod.regulation}</span>
                <span className="text-slate-500 mx-2">·</span>
                <span className="text-slate-300 text-sm">{mod.role}</span>
              </div>
              {mod.done && mod.qualityScore !== undefined && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${scoreBadge(mod.qualityScore)}`}>
                  Quality {mod.qualityScore}/100
                </span>
              )}
            </div>
            <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
              {mod.content}
              {!mod.done && <span className="animate-pulse text-indigo-400">▌</span>}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
