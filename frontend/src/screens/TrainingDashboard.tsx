import { useState, useEffect } from 'react';
import { useApi } from '../utils/api';
import type { TrainingModuleWithProgress, TrainingProgress } from '../types';

const REG_COLORS: Record<string, string> = {
  AML: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  KYC: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  GDPR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DORA: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  MiFID: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

function regColor(regulation: string) {
  for (const key of Object.keys(REG_COLORS)) {
    if (regulation.toUpperCase().includes(key)) return REG_COLORS[key];
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#1E293B" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke="#6366F1" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export default function TrainingDashboard() {
  const apiFetch = useApi();
  const [modules, setModules] = useState<TrainingModuleWithProgress[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [modRes, progRes] = await Promise.all([
      apiFetch('/api/training/my-modules'),
      apiFetch('/api/training/my-progress'),
    ]);
    if (modRes.ok) setModules(await modRes.json());
    if (progRes.ok) setProgress(await progRes.json());
  }

  async function markComplete(id: string) {
    setCompleting(prev => new Set(prev).add(id));
    const res = await apiFetch(`/api/training/my-modules/${id}/complete`, { method: 'POST' });
    if (res.ok) {
      const { completed_at } = await res.json();
      setModules(prev => prev.map(m => m.id === id ? { ...m, completed_at } : m));
      setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : prev);
    }
    setCompleting(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  const filtered = modules.filter(m => {
    if (filter === 'pending') return !m.completed_at;
    if (filter === 'done') return !!m.completed_at;
    return true;
  });

  const pct = progress ? Math.round((progress.completed / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header row */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">My Training</h1>
          <p className="text-slate-400 text-sm mt-1">Complete your assigned compliance modules.</p>
        </div>

        {/* Progress ring */}
        {progress && (
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <ProgressRing pct={pct} />
              <span className="absolute text-xs font-semibold text-white">{pct}%</span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{progress.completed} / {progress.total}</p>
              <p className="text-slate-500 text-xs">modules done</p>
            </div>
          </div>
        )}
      </div>

      {/* Regulation breakdown */}
      {progress && progress.byRegulation.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {progress.byRegulation.map(r => (
            <div key={r.regulation} className={`rounded-xl border px-3 py-2.5 ${regColor(r.regulation)}`}>
              <p className="text-xs font-semibold truncate">{r.regulation}</p>
              <p className="text-[10px] opacity-70 mt-0.5">{r.completed}/{r.total} done</p>
              <div className="mt-1.5 h-1 rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-current opacity-60 transition-all duration-500"
                  style={{ width: `${(r.completed / Math.max(r.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#1E293B] border border-white/5 rounded-xl p-1 w-fit">
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-all ${
              filter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Module grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">No modules here.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const done = !!m.completed_at;
            const busy = completing.has(m.id);
            return (
              <div
                key={m.id}
                className={`flex flex-col rounded-2xl border p-5 transition-all ${
                  done
                    ? 'bg-emerald-500/5 border-emerald-500/15'
                    : 'bg-[#1E293B] border-white/5 hover:border-white/10'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${regColor(m.regulation)}`}>
                    {m.regulation}
                  </span>
                  {done ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                      Completed
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">Not started</span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-white leading-snug mb-2">
                  {m.regulation} — {m.role}
                </h3>

                {/* Preview */}
                <p className="text-xs text-slate-500 leading-relaxed flex-1 line-clamp-3">
                  {m.content?.slice(0, 160) ?? ''}
                </p>

                {/* Quality score */}
                {m.quality_score !== null && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1 rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${m.quality_score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{m.quality_score}%</span>
                  </div>
                )}

                {/* Action */}
                {!done && (
                  <button
                    onClick={() => markComplete(m.id)}
                    disabled={busy}
                    className="mt-4 w-full py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-40 transition-all border border-white/5"
                  >
                    {busy ? 'Saving…' : 'Mark as Read'}
                  </button>
                )}

                {done && m.completed_at && (
                  <p className="mt-3 text-[10px] text-emerald-500/70">
                    {new Date(m.completed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
