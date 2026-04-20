/**
 * Analyses a company's risk profiles and identifies compliance gaps.
 * A gap is any regulation scored below 70 — chosen as the threshold where
 * meaningful training intervention is required before a formal audit.
 */

// Maps each regulation to the business roles responsible for compliance.
// Kept here (not in the DB) because role assignments are domain knowledge
// that should version alongside the code, not live as mutable config data.
export const ROLE_MAP: Record<string, string[]> = {
  AML: ['Compliance Officer', 'Front Office', 'Onboarding'],
  KYC: ['Compliance Officer', 'Customer Service', 'Onboarding'],
  GDPR: ['All roles'], // GDPR applies organisation-wide, not to a single team
  DORA: ['IT Team', 'Risk Officer', 'Senior Management'],
  'MiFID II': ['Front Office', 'Risk Officer', 'Compliance Officer'],
};

export interface Gap {
  regulation: string;
  score: number;
  roles: string[];
}

export function analyzeGaps(
  profiles: { regulation: string; score: number }[]
): Gap[] {
  return profiles
    .filter((p) => p.score < 70)
    .map((p) => ({
      regulation: p.regulation,
      score: p.score,
      // Unknown regulations default to org-wide training rather than silently dropping them
      roles: ROLE_MAP[p.regulation] ?? ['All roles'],
    }));
}
