import type { LucideIcon } from 'lucide-react';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

export function IconChip({
  icon: Icon, label, sub, className,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4', className)} style={{ background: brand.cream, borderColor: 'rgba(29,16,7,0.08)' }}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: brand.espresso }}>
        <Icon className="h-4 w-4" style={{ color: brand.amber }} strokeWidth={2} />
      </div>
      <p className="text-sm font-semibold" style={{ color: brand.espresso }}>{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: '#6B5D48' }}>{sub}</p>}
    </div>
  );
}
