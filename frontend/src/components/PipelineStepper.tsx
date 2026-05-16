import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  label: string;
  path: string;
}

interface PipelineStepperProps {
  steps: Step[];
  currentStep: string;
  onNavigate: (path: string) => void;
}

export function PipelineStepper({ steps, currentStep, onNavigate }: PipelineStepperProps) {
  const currentIdx = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center gap-0.5 mb-8">
      {steps.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.id} className="flex items-center gap-0.5">
            <button
              onClick={() => onNavigate(step.path)}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                isComplete && 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer',
                isCurrent && 'bg-primary text-primary-foreground shadow-sm scale-105 cursor-default',
                isFuture && 'bg-muted text-muted-foreground cursor-default opacity-60',
              )}
              disabled={isFuture}
            >
              <span className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                isComplete && 'bg-primary text-primary-foreground',
                isCurrent && 'bg-primary-foreground text-primary',
                isFuture && 'bg-muted-foreground/20 text-muted-foreground',
              )}>
                {isComplete ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className={cn(
                'h-3 w-3 shrink-0 transition-colors',
                isComplete ? 'text-primary/40' : 'text-muted-foreground/20',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export const PIPELINE_STEPS: Step[] = [
  { id: 'role',   label: 'Role Import',         path: '' },
  { id: 'risk',   label: 'Risk Assessment',     path: '/risk' },
  { id: 'amlr',   label: 'AMLR Mapping',        path: '/amlr' },
  { id: 'plan',   label: 'Training Plan',       path: '/plan' },
  { id: 'lms',    label: 'LMS Assignment',      path: '/lms' },
];