import { useState, FormEvent } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const INDUSTRIES = ['Banking', 'Fintech', 'Insurance', 'Asset Management', 'Payment Services', 'Other'];
const SIZES = ['1-50', '51-200', '201-500', '501-1000', '1000+'];
const ALL_REGULATIONS = ['AML', 'KYC', 'GDPR', 'DORA', 'MIFID2'];
const REG_LABELS: Record<string, string> = {
  AML: 'Anti-Money Laundering',
  KYC: 'Know Your Customer',
  GDPR: 'General Data Protection',
  DORA: 'Digital Operational Resilience',
  MIFID2: 'Markets in Financial Instruments',
};

function severityBadge(score: number) {
  if (score < 40) return { label: 'Critical gap', variant: 'destructive' as const };
  if (score < 55) return { label: 'High gap', variant: 'warning' as const };
  if (score < 70) return { label: 'Medium gap', variant: 'warning' as const };
  return { label: 'Compliant', variant: 'success' as const };
}

interface Props { onCompanyCreated: (id: string) => void; }

export default function Onboarding({ onCompanyCreated }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0] ?? 'Banking');
  const [size, setSize] = useState(SIZES[3] ?? '501-1000');
  const [selectedRegs, setSelectedRegs] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleReg(reg: string) {
    setSelectedRegs(prev => prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]);
    if (!scores[reg]) setScores(prev => ({ ...prev, [reg]: 50 }));
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
      const regulationsMap: Record<string, number> = {};
      for (const reg of selectedRegs) regulationsMap[reg] = scores[reg] ?? 50;
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, industry, size, regulations: regulationsMap }),
      });
      if (!res.ok) throw new Error();
      const { companyId } = await res.json() as { companyId: string };
      onCompanyCreated(companyId);
    } catch {
      setError('Something went wrong. Is the backend running?');
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Company Setup</h1>
        </div>
        <p className="text-sm text-muted-foreground">Configure your company profile and compliance risk scores.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nordic Bank AB"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <select
                  id="industry"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size">Company size</Label>
                <select
                  id="size"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {SIZES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm">Regulations & Governance Scores</CardTitle>
            <CardDescription>Select applicable regulations and rate your current compliance score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALL_REGULATIONS.map(reg => {
              const score = scores[reg] ?? 50;
              const { label, variant } = severityBadge(score);
              const selected = selectedRegs.includes(reg);
              return (
                <div key={reg} className={`rounded-lg border p-4 transition-colors ${selected ? 'border-primary/30 bg-accent/30' : 'border-border'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleReg(reg)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{reg}</span>
                      <span className="ml-2 text-xs text-muted-foreground">— {REG_LABELS[reg] ?? reg}</span>
                    </div>
                  </label>
                  {selected && (
                    <div className="mt-3 pl-7">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Governance score: <strong>{score}</strong></span>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                      <input
                        type="range" min={0} max={100} value={score}
                        onChange={e => setScores(prev => ({ ...prev, [reg]: Number(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading || selectedRegs.length === 0} className="w-full">
          {loading ? 'Saving…' : 'Generate Training Plan'}
          {!loading && <ChevronRight className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
