import { useState, FormEvent } from 'react';

const INDUSTRIES = ['Banking', 'Fintech', 'Insurance', 'Asset Management', 'Payment Services', 'Other'];
const SIZES = ['1-50', '51-200', '201-500', '501-1000', '1000+'];
const ALL_REGULATIONS = ['AML', 'KYC', 'GDPR', 'DORA', 'MIFID2'];
const REG_LABELS: Record<string, string> = {
  AML: 'AML — Anti-Money Laundering',
  KYC: 'KYC — Know Your Customer',
  GDPR: 'GDPR — General Data Protection',
  DORA: 'DORA — Digital Operational Resilience',
  MIFID2: 'MiFID II — Markets in Financial Instruments',
};

function severityLabel(score: number): { label: string; color: string } {
  if (score < 40) return { label: 'Critical gap', color: 'text-red-400' };
  if (score < 55) return { label: 'High gap', color: 'text-orange-400' };
  if (score < 70) return { label: 'Medium gap', color: 'text-amber-400' };
  return { label: 'Compliant', color: 'text-green-400' };
}

interface Props {
  onCompanyCreated: (companyId: string) => void;
}

export default function Onboarding({ onCompanyCreated }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0] ?? 'Banking');
  const [size, setSize] = useState(SIZES[3] ?? '501-1000');
  const [selectedRegs, setSelectedRegs] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleReg(reg: string) {
    setSelectedRegs(prev =>
      prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]
    );
    if (!scores[reg]) {
      setScores(prev => ({ ...prev, [reg]: 50 }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedRegs.length === 0) {
      setError('Enter a company name and select at least one regulation.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // V2: regulations is Record<string, number> — not array + scores map
      const regulationsMap: Record<string, number> = {};
      for (const reg of selectedRegs) {
        regulationsMap[reg] = scores[reg] ?? 50;
      }
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, industry, size, regulations: regulationsMap }),
      });
      if (!res.ok) throw new Error();
      const { companyId } = (await res.json()) as { companyId: string };
      onCompanyCreated(companyId);
    } catch {
      setError('Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const hasGaps = selectedRegs.some(r => (scores[r] ?? 50) < 70);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-indigo-400">Vidda</span> Automation
          </h1>
          <p className="text-slate-400 text-sm">AI-powered compliance training generation</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1E293B] rounded-2xl p-8 space-y-6 shadow-xl">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Company name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nordic Bank AB"
              className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Industry</label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Company size</label>
              <select
                value={size}
                onChange={e => setSize(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Regulations & governance scores</label>
            <div className="space-y-4">
              {ALL_REGULATIONS.map(reg => {
                const score = scores[reg] ?? 50;
                const sev = severityLabel(score);
                return (
                  <div key={reg}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRegs.includes(reg)}
                        onChange={() => toggleReg(reg)}
                        className="w-4 h-4 accent-indigo-500"
                      />
                      <span className="font-medium text-sm">{REG_LABELS[reg] ?? reg}</span>
                    </label>
                    {selectedRegs.includes(reg) && (
                      <div className="mt-2 ml-7">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Governance score</span>
                          <span className={`font-semibold ${sev.color}`}>
                            {score} — {sev.label}
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={100}
                          value={score}
                          onChange={e => setScores(prev => ({ ...prev, [reg]: Number(e.target.value) }))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {hasGaps && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-amber-300 text-xs">
              ⚠️ Gaps detected — training modules will be automatically generated for affected roles.
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || selectedRegs.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg py-3 font-semibold"
          >
            {loading ? 'Saving...' : 'Generate Training Plan →'}
          </button>
        </form>
      </div>
    </div>
  );
}
