import { useState } from 'react';
import { useUser } from '@clerk/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useApi } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoTile } from '@/components/Logo';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

export default function CompanyOnboarding() {
  const api = useApi();
  const { user } = useUser();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !industry.trim()) return;

    setSubmitting(true);
    try {
      const res = await api('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), industry: industry.trim(), size: size || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not create company');
        return;
      }
      // Clerk's publicMetadata was just updated server-side — refetch this
      // session's user so App.tsx's companyId check reads the new value.
      await user?.reload();
      toast.success('Company profile created');
    } catch {
      toast.error('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <LogoTile size={36} />
          <div className="text-center">
            <h1 className="text-xl font-semibold">Set up your company</h1>
            <p className="text-sm text-muted-foreground">
              One-time step — this becomes your organization's compliance workspace.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Financial Services"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Banking, insurance, fintech…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="size">Company size</Label>
            <select
              id="size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select a range (optional)</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create company & continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
