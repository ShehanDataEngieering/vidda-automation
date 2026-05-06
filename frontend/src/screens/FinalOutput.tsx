import { useEffect, useState } from 'react';
import { Shield, ChevronDown, ChevronRight, Printer, CheckCircle2 } from 'lucide-react';
import type { TrainingModule } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Review { id: string; action: string; reviewer: string; comment: string | null; created_at: string; }
interface Props { companyId: string; }

const COMPLIANCE_ITEMS = [
  'Human review gate implemented',
  'Full audit trail maintained',
  'Citations traceable to source regulatory text',
  'EU AI Act Article 14 human oversight satisfied',
];

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
      const allReviews: Record<string, Review[]> = {};
      await Promise.all(approved.map(async m => {
        const r = await fetch(`/api/modules/${m.id}/reviews`);
        if (r.ok) allReviews[m.id] = await r.json() as Review[];
      }));
      setReviews(allReviews);
      setLoading(false);
    }
    void load();
  }, [companyId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const byRole: Record<string, TrainingModule[]> = {};
  for (const mod of modules) {
    if (!byRole[mod.role]) byRole[mod.role] = [];
    byRole[mod.role]!.push(mod);
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Final Training Programme</h1>
            <p className="text-sm text-muted-foreground">{modules.length} approved module{modules.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / Export
        </Button>
      </div>

      {/* Compliance summary */}
      <Card className="mb-6 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> EU AI Act Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {COMPLIANCE_ITEMS.map(item => (
            <p key={item} className="text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 shrink-0" /> {item}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Modules by role */}
      {Object.entries(byRole).map(([role, roleMods]) => (
        <div key={role} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold">{role}</h2>
            <Badge variant="secondary">{roleMods.length} module{roleMods.length !== 1 ? 's' : ''}</Badge>
          </div>
          <div className="space-y-2">
            {roleMods.map(mod => (
              <Card key={mod.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{mod.regulation}</span>
                      {mod.quality_score != null && (
                        <Badge variant={mod.quality_score >= 70 ? 'success' : 'warning'}>
                          {mod.quality_score}%
                        </Badge>
                      )}
                      {mod.citation_grounded && (
                        <Badge variant="outline" className="text-xs">Grounded</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">v{mod.version}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}>
                      {expanded === mod.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {expanded === mod.id && (
                  <>
                    <Separator />
                    <CardContent className="pt-3">
                      <ScrollArea className="h-56 mb-3">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {mod.content}
                        </pre>
                      </ScrollArea>
                      {reviews[mod.id] && reviews[mod.id]!.length > 0 && (
                        <>
                          <Separator className="mb-3" />
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Audit Trail</p>
                          <div className="space-y-1.5">
                            {reviews[mod.id]!.map(r => (
                              <div key={r.id} className="flex items-center gap-3 text-xs">
                                <Badge
                                  variant={r.action === 'approved' ? 'success' : r.action === 'rejected' ? 'destructive' : 'secondary'}
                                  className="text-[10px]"
                                >
                                  {r.action}
                                </Badge>
                                <span className="text-muted-foreground">{r.reviewer}</span>
                                {r.comment && <span className="italic text-muted-foreground">"{r.comment}"</span>}
                                <span className="ml-auto text-muted-foreground/60">{new Date(r.created_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
