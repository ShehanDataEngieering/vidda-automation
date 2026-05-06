import { useEffect, useState } from 'react';
import type { SseEvent } from '../types';

interface ModuleCard {
  moduleId: string;
  regulation: string;
  role: string;
  content: string;
  qualityScore?: number;
  citationGrounded?: boolean;
  warnings?: string[];
  done: boolean;
}

interface Props {
  companyId: string;
  onComplete: () => void;
}

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

const PIPELINE_STAGES = [
  '📥 Analysing risk profile',
  '🔍 Identifying gaps',
  '📚 Searching regulatory DB',
  '⚖️ Reranking results',
  '🤖 Generating modules',
  '✅ Quality check',
  '👤 Awaiting human review',
];

export default function Generation({ companyId, onComplete }: Props) {
  const [stageMsg, setStageMsg] = useState('Starting pipeline...');
  const [modules, setModules] = useState<ModuleCard[]>([]);
  const [complete, setComplete] = useState(false);
  const [totalModules, setTotalModules] = useState(0);
  const [error, setError] = useState('');
  const [stageIdx, setStageIdx] = useState(0);

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
            const event = JSON.parse(line.slice(6)) as SseEvent;

            if (event.type === 'stage') {
              setStageMsg(event.message);
              setStageIdx(i => Math.min(i + 1, PIPELINE_STAGES.length - 1));
            }
            if (event.type === 'gap_found') {
              setStageIdx(1);
            }
            if (event.type === 'module_start') {
              setStageIdx(4);
              setModules(prev => [
                ...prev,
                { moduleId: event.moduleId, regulation: event.regulation, role: event.role, content: '', done: false },
              ]);
            }
            if (event.type === 'chunk') {
              const id = event.moduleId;
              setModules(prev =>
                prev.map(m => m.moduleId === id ? { ...m, content: m.content + event.content } : m)
              );
            }
            if (event.type === 'module_done') {
              setStageIdx(5);
              setModules(prev =>
                prev.map(m =>
                  m.moduleId === event.moduleId
                    ? { ...m, done: true, qualityScore: event.qualityScore, citationGrounded: event.citationGrounded, warnings: event.warnings }
                    : m
                )
              );
            }
            if (event.type === 'complete') {
              setComplete(true);
              setTotalModules(event.totalModules);
              setStageIdx(PIPELINE_STAGES.length - 1);
            }
            if (event.type === 'error') {
              setError(event.message);
            }
          }
        }
      } catch {
        if (!closed) setError('Connection error. Is the backend running?');
      }
    }

    run();
    return () => { closed = true; };
  }, [companyId]);

  const completedCount = modules.filter(m => m.done).length;

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          <span className="text-indigo-400">Vidda</span> Automation
        </h1>
        <p className="text-slate-400 text-sm">Generating compliance training modules</p>
      </div>

      {/* Pipeline stage bar */}
      <div className="bg-[#1E293B] rounded-xl p-5 mb-6">
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {PIPELINE_STAGES.map((s, i) => (
            <div key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              i < stageIdx ? 'bg-indigo-600 text-white' :
              i === stageIdx ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500' :
              'bg-slate-700/50 text-slate-500'
            }`}>
              {i < stageIdx ? '✓ ' : ''}{s.replace(/^[^\s]+ /, '')}
            </div>
          ))}
        </div>
        <p className="text-slate-300 text-sm font-medium">{stageMsg}</p>
        {modules.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Modules generated</span>
              <span>{completedCount} / {modules.length}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: modules.length > 0 ? `${(completedCount / modules.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {complete && modules.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-sm">
          ✅ No compliance gaps detected — all regulation scores are above 70.
        </div>
      )}

      {/* Module cards */}
      <div className="space-y-5">
        {modules.map(mod => (
          <div key={mod.moduleId} className="bg-[#1E293B] rounded-xl p-6">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div>
                <span className="text-indigo-400 font-semibold text-sm">{mod.regulation}</span>
                <span className="text-slate-500 mx-2">·</span>
                <span className="text-slate-300 text-sm">{mod.role}</span>
              </div>
              {mod.done && mod.qualityScore !== undefined && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${scoreBadge(mod.qualityScore)}`}>
                    {mod.qualityScore}/100
                  </span>
                  <span className="text-xs" title="Citation grounding">
                    {mod.citationGrounded ? '✅' : '⚠️'}
                  </span>
                </div>
              )}
            </div>
            {mod.done && mod.warnings && mod.warnings.length > 0 && (
              <div className="mb-3 text-xs text-amber-400 space-y-0.5">
                {mod.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
              {mod.content}
              {!mod.done && <span className="animate-pulse text-indigo-400">▌</span>}
            </pre>
          </div>
        ))}
      </div>

      {complete && totalModules > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={onComplete}
            className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl px-8 py-3 font-semibold text-lg"
          >
            Review Modules →
          </button>
        </div>
      )}
    </div>
  );
}
