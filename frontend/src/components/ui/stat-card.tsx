import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { brand } from '@/lib/brand';

export function StatCard({
  label, value, sub, icon: Icon, trend, className,
}: {
  label: string;
  value: string | number;
  sub?: string | undefined;
  icon?: React.ElementType | undefined;
  trend?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center" style={{ background: brand.espresso }}>
            <Icon className="h-4 w-4" style={{ color: brand.amber }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
