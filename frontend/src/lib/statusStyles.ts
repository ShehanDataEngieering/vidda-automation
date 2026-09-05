import { CheckCircle2, Clock, Circle, type LucideIcon } from 'lucide-react';

export const ASSIGNMENT_STATUS: Record<string, { icon: LucideIcon; label: string; badgeClass: string; iconClass: string }> = {
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  in_progress: {
    icon: Clock,
    label: 'In Progress',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  not_started: {
    icon: Circle,
    label: 'Not Started',
    badgeClass: 'bg-muted text-muted-foreground',
    iconClass: 'text-muted-foreground/30',
  },
};
