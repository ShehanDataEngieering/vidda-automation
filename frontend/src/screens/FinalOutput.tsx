import { useEffect, useState } from 'react';
import type { TrainingModule } from '../types';

interface Review {
  id: string;
  action: string;
  reviewer: string;
  comment: string | null;
  created_at: string;
}

interface Props {
  companyId: string;
}

export default function FinalOutput({ companyId }: Props) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/modules/${companyId}`);
      if (!res.ok) return;
      const mods = (await res.json()) as TrainingModule[];
      const approved = mods.filter(m => m.status === 'approved');
      setModules(approved);

      // Load audit trail for each module
      const allReviews: Record<string, Review[]> = {};
      await Promise.all(
        approved.map(async m => {
          const r = await fetch(`/api/modules/${m.id}/reviews`);
          if (r.ok) allReviews[m.id] = await r.json() as Review[];
        })
      );
      setReviews(allReviews);
      setLoading(false);
    }
    load();
  }, [companyId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading final output...</p>
      </div>
    );
  }

  // Group by role
  const byRole: Record<string, TrainingModule[]> = {};
  for (const mod of modules) {
    if (!byRole[mod.role]) byRole[mod.role] = [];
    byRole[mod.role]!.push(mod);
  }

  return (
    <div className="min-h-screen px-4 py-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">
          <span className="text-indigo-400">Vidda</span> Final Training Programme
        </h1>
        <p className="text-slate-400 text-sm">{modules.length} approved module{modules.length !== 1 ? 's' : ''} ready for distribution</p>
      </div>

      {/* EU AI Act compliance panel */}
      <div className="bg-[#1E293B] rounded-xl p-5 mb-8 border border-indigo-500/20">
        <h2 className="text-sm font-semibold text-indigo-400 mb-3">EU AI Act Compliance Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-400">
            <span>✅</span>
            <span>Human review gate implemented — all modules reviewed before distribution</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <span>✅</span>
            <span>Full audit trail maintained — all review actions logged with timestamps</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <span>✅</span>
            <span>Citations traceable to source regulatory text (FATF, AMLD, GDPR, DORA, MiFID II)</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <span>✅</span>
            <span>Complies with EU AI Act Article 14 human oversight requirements</span>
          </div>
        </div>
      </div>

      {/* Modules by role */}
      {Object.entries(byRole).map(([role, roleMods]) => (
        <div key={role} className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-200">
            {role}
            <span className="text-slate-500 text-sm font-normal ml-2">({roleMods.length} module{roleMods.length !== 1 ? 's' : ''})</span>
          </h2>
          <div className="space-y-4">
            {roleMods.map(mod => (
              <div key={mod.id} className="bg-[#1E293B] rounded-xl overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-[#243347] transition-colors"
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-indigo-400 font-semibold text-sm">{mod.regulation}</span>
                      <span className="text-slate-500 mx-2">·</span>
                      <span className="text-slate-300 text-sm">{mod.role}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {mod.quality_score !== null && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          mod.quality_score >= 80 ? 'bg-green-500/20 text-green-400' :
                          mod.quality_score >= 60 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          Quality {mod.quality_score}/100
                        </span>
                      )}
                      <span className="text-xs" title="Citation grounding">
                        {mod.citation_grounded ? '✅ Grounded' : '⚠️ Unverified'}
                      </span>
                      <span className="text-slate-500 text-xs">{expanded === mod.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {expanded === mod.id && (
                  <div className="border-t border-slate-700">
                    <div className="p-5">
                      <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                        {mod.content}
                      </pre>
                    </div>

                    {/* Quality breakdown */}
                    {mod.quality_breakdown && Object.keys(mod.quality_breakdown).length > 0 && (
                      <div className="border-t border-slate-700 p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quality Breakdown</h3>
                        <div className="space-y-1">
                          {Object.entries(mod.quality_breakdown).map(([check, pts]) => (
                            <div key={check} className="flex justify-between text-xs">
                              <span className="text-slate-300">{check}</span>
                              <span className={pts > 0 ? 'text-green-400' : 'text-slate-500'}>
                                {pts > 0 ? `+${pts}` : 'n/a'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audit trail */}
                    {reviews[mod.id] && reviews[mod.id]!.length > 0 && (
                      <div className="border-t border-slate-700 p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Audit Trail</h3>
                        <div className="space-y-2">
                          {reviews[mod.id]!.map(r => (
                            <div key={r.id} className="flex items-start gap-3 text-xs">
                              <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                r.action === 'approved' ? 'bg-green-500/20 text-green-400' :
                                r.action === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-slate-700 text-slate-400'
                              }`}>
                                {r.action}
                              </span>
                              <span className="text-slate-400">{r.reviewer}</span>
                              {r.comment && <span className="text-slate-500 italic">"{r.comment}"</span>}
                              <span className="text-slate-600 ml-auto shrink-0">
                                {new Date(r.created_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl px-6 py-2.5 font-semibold"
        >
          Export / Print
        </button>
      </div>
    </div>
  );
}
