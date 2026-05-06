import { useEffect, useState } from 'react';
import type { TrainingModule, SseEvent } from '../types';

interface Props {
  companyId: string;
  onFinish: () => void;
}

function scoreBadge(score: number | null) {
  if (score === null) return 'bg-slate-700 text-slate-400';
  if (score >= 80) return 'bg-green-500/20 text-green-400';
  if (score >= 60) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
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

  useEffect(() => { fetchModules(); }, [companyId]);

  async function approve(moduleId: string) {
    await fetch(`/api/modules/${moduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approved', reviewer: 'Compliance Officer' }),
    });
    fetchModules();
  }

  async function reject(moduleId: string) {
    if (!rejectReason.trim()) return;
    await fetch(`/api/modules/${moduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rejected', reviewer: 'Compliance Officer', comment: rejectReason }),
    });
    setRejectingId(null);
    setRejectReason('');
    // Auto-regenerate
    startRegen(moduleId, rejectReason);
  }

  async function startRegen(moduleId: string, reason: string) {
    setRegenActive(moduleId);
    setRegenContent(prev => ({ ...prev, [moduleId]: '' }));

    const res = await fetch(`/api/modules/${moduleId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6)) as SseEvent;
        if (event.type === 'chunk') {
          setRegenContent(prev => ({ ...prev, [moduleId]: (prev[moduleId] ?? '') + event.content }));
        }
        if (event.type === 'complete') {
          setRegenActive(null);
          fetchModules();
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading modules...</p>
      </div>
    );
  }

  const stats = {
    total: modules.length,
    pending: modules.filter(m => m.status === 'pending').length,
    approved: modules.filter(m => m.status === 'approved').length,
    rejected: modules.filter(m => m.status === 'rejected').length,
  };

  const allApproved = stats.approved === stats.total && stats.total > 0;

  return (
    <div className="min-h-screen px-4 py-12 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            <span className="text-indigo-400">Vidda</span> Review Dashboard
          </h1>
          <p className="text-slate-400 text-sm">Human review gate — EU AI Act Article 14 compliance</p>
        </div>
        {allApproved && (
          <button
            onClick={onFinish}
            className="bg-green-600 hover:bg-green-500 transition-colors rounded-xl px-6 py-2.5 font-semibold"
          >
            View Final Output →
          </button>
        )}
      </div>

      {/* EU AI Act badge */}
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 mb-6 text-sm text-indigo-300">
        ⚖️ <strong>High-risk AI system</strong> — Human review required before distribution.
        This satisfies EU AI Act Article 14 human oversight requirements.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Approved', value: stats.approved, color: 'text-green-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1E293B] rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Module table */}
      <div className="space-y-4">
        {modules.map(mod => (
          <div key={mod.id} className="bg-[#1E293B] rounded-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-indigo-400 font-semibold text-sm">{mod.regulation}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-300 text-sm">{mod.role}</span>
                    {mod.version > 1 && (
                      <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">v{mod.version}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    ⚖️ Assigned because: {mod.regulation} gap. Role: {mod.role}.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {mod.quality_score !== null && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${scoreBadge(mod.quality_score)}`}>
                      {mod.quality_score}/100
                    </span>
                  )}
                  <span className="text-xs" title="Citation grounding">
                    {mod.citation_grounded ? '✅ Grounded' : '⚠️ Unverified'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    mod.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    mod.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {mod.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {expanded === mod.id ? '▲ Hide' : '▼ View'} content
                </button>
                {mod.status === 'pending' && (
                  <>
                    <button
                      onClick={() => approve(mod.id)}
                      className="text-xs bg-green-600 hover:bg-green-500 transition-colors px-3 py-1 rounded-lg ml-auto"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => { setRejectingId(mod.id); setRejectReason(''); }}
                      className="text-xs bg-red-600 hover:bg-red-500 transition-colors px-3 py-1 rounded-lg"
                    >
                      ❌ Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {expanded === mod.id && (
              <div className="border-t border-slate-700 p-5">
                <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                  {regenActive === mod.id ? regenContent[mod.id] : mod.content}
                  {regenActive === mod.id && <span className="animate-pulse text-indigo-400">▌</span>}
                </pre>
              </div>
            )}

            {rejectingId === mod.id && (
              <div className="border-t border-slate-700 p-5">
                <p className="text-sm text-slate-300 mb-2">Rejection reason (sent back to AI for regeneration):</p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Missing specific Article 13 reference for Front Office role"
                  className="w-full bg-[#0F172A] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => reject(mod.id)}
                    disabled={!rejectReason.trim()}
                    className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors px-4 py-2 rounded-lg"
                  >
                    Reject & Regenerate
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="text-xs text-slate-400 hover:text-white px-4 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {allApproved && (
        <div className="mt-8 text-center">
          <button
            onClick={onFinish}
            className="bg-green-600 hover:bg-green-500 transition-colors rounded-xl px-8 py-3 font-semibold text-lg"
          >
            View Final Output →
          </button>
        </div>
      )}
    </div>
  );
}
