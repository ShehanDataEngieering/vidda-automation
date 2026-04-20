import { useState, FormEvent } from 'react';

const INDUSTRIES = ['Banking', 'Insurance', 'Asset Management', 'Fintech', 'Other'];
const ALL_REGULATIONS = ['AML', 'KYC', 'GDPR', 'DORA', 'MiFID II'];

interface Props {
  onCompanyCreated: (companyId: string) => void;
}

export default function Onboarding({ onCompanyCreated }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [selectedRegs, setSelectedRegs] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleReg(reg: string) {
    setSelectedRegs((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg]
    );
    setScores((prev) => ({ ...prev, [reg]: prev[reg] ?? 50 }));
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
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, industry, regulations: selectedRegs, scores }),
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
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Financial Ltd"
              className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Regulations to assess</label>
            <div className="space-y-4">
              {ALL_REGULATIONS.map((reg) => (
                <div key={reg}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRegs.includes(reg)}
                      onChange={() => toggleReg(reg)}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span className="font-medium">{reg}</span>
                  </label>
                  {selectedRegs.includes(reg) && (
                    <div className="mt-2 ml-7">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Governance score</span>
                        <span className={(scores[reg] ?? 50) < 70 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                          {scores[reg] ?? 50} — {(scores[reg] ?? 50) < 70 ? 'gap detected' : 'compliant'}
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={100}
                        value={scores[reg] ?? 50}
                        onChange={(e) => setScores((prev) => ({ ...prev, [reg]: Number(e.target.value) }))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg py-3 font-semibold"
          >
            {loading ? 'Saving...' : 'Generate Training Modules →'}
          </button>
        </form>
      </div>
    </div>
  );
}
