import type { Gap } from '../types';

const ROLE_MAP: Record<string, string[]> = {
  AML:    ['Compliance Officer', 'Front Office', 'Onboarding Team'],
  KYC:    ['Compliance Officer', 'Customer Service', 'Onboarding Team'],
  GDPR:   ['All Staff', 'IT Team', 'HR Department'],
  DORA:   ['IT Team', 'Risk Officer', 'Senior Management'],
  MIFID2: ['Front Office', 'Risk Officer', 'Compliance Officer'],
};

const GAP_THRESHOLD = 70;

export function analyzeGaps(
  profiles: { regulation: string; score: number }[]
): Gap[] {
  return profiles
    .filter(p => p.score < GAP_THRESHOLD)
    .map(p => ({
      regulation: p.regulation,
      score: p.score,
      severity: (p.score < 40 ? 'critical' : p.score < 55 ? 'high' : 'medium') as Gap['severity'],
      affectedRoles: ROLE_MAP[p.regulation] ?? ['All Staff'],
    }));
}
