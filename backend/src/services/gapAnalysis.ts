import type { Gap, RiskDimensions, RoleProfile } from '../types';

// ---------------------------------------------------------------------------
// AMLR 2024/1624 role profiles — derived from hackathon role descriptions
// ---------------------------------------------------------------------------

const AMLR_ROLES: Record<string, RoleProfile> = {
  'KYC Analyst (EDD)': {
    title: 'KYC Analyst (EDD)',
    description:
      'Conducts enhanced due diligence on high-risk customers, verifies identity documentation, and performs ongoing monitoring of suspicious account activity. First line of defence against onboarding financial criminals.',
    riskDimensions: { aml: 'high', sanctions: 'high', fraud: 'medium', documentation: 'high' },
    regulatoryArticles: ['Article 12', 'Article 13', 'Article 15'],
  },
  'AML DDI Manager': {
    title: 'AML DDI Manager',
    description:
      "Leads the AML Due Diligence and Investigations team. Oversees complex STR investigations, manages escalations, and ensures the institution's AML detection capabilities meet regulatory standards.",
    riskDimensions: { aml: 'high', sanctions: 'high', fraud: 'medium', documentation: 'high' },
    regulatoryArticles: ['Article 9', 'Article 12', 'Article 14'],
  },
  'Customer Advisor': {
    title: 'Customer Advisor',
    description:
      'Front-line staff member who opens accounts and handles daily customer interactions. Must identify red flags, apply CDD procedures, and refer suspicious activity without tipping off the customer.',
    riskDimensions: { aml: 'medium', sanctions: 'medium', fraud: 'high', documentation: 'medium' },
    regulatoryArticles: ['Article 12', 'Article 13'],
  },
  MLRO: {
    title: 'MLRO',
    description:
      "Money Laundering Reporting Officer — senior compliance function responsible for receiving internal SAR/STR reports, deciding on external reporting to FIU, and maintaining the institution's overall AML framework under AMLR obligations.",
    riskDimensions: { aml: 'high', sanctions: 'high', fraud: 'high', documentation: 'high' },
    regulatoryArticles: ['Article 9', 'Article 11', 'Article 12', 'Article 14'],
  },
};

// ---------------------------------------------------------------------------
// Generic role profiles for non-AML regulations
// ---------------------------------------------------------------------------

const GENERIC_PROFILES: Record<string, Record<string, RoleProfile>> = {
  KYC: {
    'Compliance Officer': {
      title: 'Compliance Officer',
      description: "Ensures the institution's KYC procedures comply with regulatory requirements.",
      riskDimensions: { aml: 'high', sanctions: 'medium', fraud: 'low', documentation: 'high' },
      regulatoryArticles: ['Article 8', 'Article 13'],
    },
    'Customer Service': {
      title: 'Customer Service',
      description: 'Handles customer onboarding and document collection for KYC verification.',
      riskDimensions: { aml: 'medium', sanctions: 'low', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 8'],
    },
    'Onboarding Team': {
      title: 'Onboarding Team',
      description: 'Processes new client applications and conducts initial customer due diligence.',
      riskDimensions: { aml: 'medium', sanctions: 'medium', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 8', 'Article 13'],
    },
  },
  GDPR: {
    'All Staff': {
      title: 'All Staff',
      description: 'All employees who handle personal data and must comply with GDPR obligations.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'low', documentation: 'medium' },
      regulatoryArticles: ['Article 5', 'Article 6', 'Article 32'],
    },
    'IT Team': {
      title: 'IT Team',
      description: 'Responsible for implementing technical data protection measures and security controls.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 25', 'Article 32'],
    },
    'HR Department': {
      title: 'HR Department',
      description: 'Processes employee personal data and must comply with GDPR for staff records.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'low', documentation: 'high' },
      regulatoryArticles: ['Article 5', 'Article 6'],
    },
  },
  DORA: {
    'IT Team': {
      title: 'IT Team',
      description: 'Manages digital infrastructure and must implement ICT resilience requirements under DORA.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'medium', documentation: 'medium' },
      regulatoryArticles: ['Article 5', 'Article 9', 'Article 17'],
    },
    'Risk Officer': {
      title: 'Risk Officer',
      description: 'Oversees ICT risk management framework and operational resilience testing.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 5', 'Article 6'],
    },
    'Senior Management': {
      title: 'Senior Management',
      description: 'Bears ultimate responsibility for DORA compliance and ICT risk governance.',
      riskDimensions: { aml: 'none', sanctions: 'none', fraud: 'low', documentation: 'medium' },
      regulatoryArticles: ['Article 5'],
    },
  },
  MIFID2: {
    'Front Office': {
      title: 'Front Office',
      description: 'Investment advisors and traders subject to MiFID II conduct-of-business rules.',
      riskDimensions: { aml: 'medium', sanctions: 'low', fraud: 'high', documentation: 'high' },
      regulatoryArticles: ['Article 24', 'Article 25'],
    },
    'Risk Officer': {
      title: 'Risk Officer',
      description: 'Oversees market risk, best execution compliance, and product governance under MiFID II.',
      riskDimensions: { aml: 'low', sanctions: 'low', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 16', 'Article 24'],
    },
    'Compliance Officer': {
      title: 'Compliance Officer',
      description: 'Ensures the institution meets MiFID II conduct standards and investor protection obligations.',
      riskDimensions: { aml: 'low', sanctions: 'medium', fraud: 'medium', documentation: 'high' },
      regulatoryArticles: ['Article 16', 'Article 23', 'Article 24'],
    },
  },
};

// ---------------------------------------------------------------------------
// Rationale generation
// ---------------------------------------------------------------------------

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'CRITICAL gap',
  high: 'HIGH gap',
  medium: 'MEDIUM gap',
};

const REGULATION_CONTEXT: Record<string, string> = {
  AML: 'AMLR 2024/1624 mandates role-specific ongoing training for staff with AML/sanctions risk exposure (Article 12). Direct customer contact roles and investigation functions require targeted competency development.',
  KYC: 'Know Your Customer regulations require all staff involved in customer onboarding to maintain current competency in CDD/EDD procedures and documentation requirements.',
  GDPR: 'GDPR Article 39(1)(b) requires the Data Protection Officer to raise awareness and train staff involved in processing operations. All staff handling personal data must receive role-appropriate training.',
  DORA: 'DORA Article 5 requires management bodies to maintain ICT risk awareness. The regulation mandates continuous training for IT and risk functions to maintain operational resilience.',
  MIFID2: 'MiFID II Article 25 requires investment firms to ensure staff have appropriate qualifications and knowledge. Ongoing training is required for all roles providing investment advice or information.',
};

function buildRationale(regulation: string, score: number, severity: string, roles: string[]): string {
  const ctx = REGULATION_CONTEXT[regulation] ?? `${regulation} requires role-specific compliance training.`;
  const roleList = roles.join(', ');
  return `${regulation} training required for ${roleList} — governance score: ${score} (${SEVERITY_LABELS[severity] ?? severity}). ${ctx}`;
}

// ---------------------------------------------------------------------------
// Main analyzeGaps function
// ---------------------------------------------------------------------------

const GAP_THRESHOLD = 70;

export function analyzeGaps(
  profiles: { regulation: string; score: number }[]
): Gap[] {
  return profiles
    .filter(p => p.score < GAP_THRESHOLD)
    .map(p => {
      const severity = (
        p.score < 40 ? 'critical' : p.score < 55 ? 'high' : 'medium'
      ) as Gap['severity'];

      // Choose role profiles: AMLR-specific for AML, generic for others
      let roleProfiles: Record<string, RoleProfile>;
      if (p.regulation === 'AML') {
        roleProfiles = AMLR_ROLES;
      } else {
        roleProfiles = GENERIC_PROFILES[p.regulation] ?? {};
      }

      const affectedRoles = Object.keys(roleProfiles);
      if (affectedRoles.length === 0) {
        // Fallback for unknown regulation
        const fallbackProfile: RoleProfile = {
          title: 'All Staff',
          description: `All employees must complete ${p.regulation} compliance training.`,
          riskDimensions: { aml: 'low', sanctions: 'low', fraud: 'low', documentation: 'medium' },
          regulatoryArticles: [],
        };
        roleProfiles = { 'All Staff': fallbackProfile };
      }

      const roles = Object.keys(roleProfiles);
      const rationale = buildRationale(p.regulation, p.score, severity, roles);

      return {
        regulation: p.regulation,
        score: p.score,
        severity,
        affectedRoles: roles,
        rationale,
        roleProfiles,
      };
    });
}

// Export for use in generation route
export { AMLR_ROLES, GENERIC_PROFILES };
export type { RiskDimensions };
