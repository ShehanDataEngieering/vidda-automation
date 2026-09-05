import { Activity, Landmark, Ban, FileCheck, ArrowUpCircle, type LucideIcon } from 'lucide-react';

/** Single source of truth for the 5 AMLR risk dimensions' color/icon — shared across
 *  RiskAssessment (heatmap + cards) and TrainingPlan (module badges) so the same
 *  dimension always reads as the same color everywhere in the app. */
export const RISK_DIMENSION_META: Record<string, { icon: LucideIcon; color: string; badgeClass: string }> = {
  'AML Risk': {
    icon: Landmark,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  'Sanctions Risk': {
    icon: Ban,
    color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40',
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  'Fraud Risk': {
    icon: Activity,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  'Documentation Risk': {
    icon: FileCheck,
    color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  'Escalation Risk': {
    icon: ArrowUpCircle,
    color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
};

export const DEFAULT_RISK_DIMENSION_META = {
  icon: Activity,
  color: 'text-slate-500 bg-slate-50 dark:bg-slate-950/40',
  badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
