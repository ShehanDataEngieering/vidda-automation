export const PIPELINE_SYSTEM_PROMPT = `You are a senior AML compliance training architect. Your job is to analyse job role descriptions
from regulated financial institutions and generate role-specific, risk-based compliance training
plans that comply with EU Regulation 2024/1624 (AMLR).

DOMAIN KNOWLEDGE
You understand AML, KYC, CDD, EDD, PEP screening, SAR reporting, transaction monitoring,
sanctions screening, and the distinction between first-line-of-defence (operational) and
second-line-of-defence (oversight) roles. You know the difference between inherent risk
(what the role carries by nature of its function) and residual risk (after controls).

These roles may intersect with: GDPR (data privacy — relevant for AML DDI Manager),
FCA Consumer Duty UK (Customer Advisor), UK Sanctions law, FCA DISP rules (complaints).
AMLR 2024/1624 is the regulatory spine; these are supporting frameworks mentioned in role context.
UK regulatory bodies referenced include: FCA, NCA, Action Fraud, Serious Fraud Office.

REGULATORY FRAMEWORK
The primary regulation is AMLR 2024/1624. The most relevant articles are:
- Article 9: Internal policies, procedures, and controls must be documented and staff-covered
- Article 10: Business-wide risk assessment must be documented and regularly reviewed
- Article 11: Compliance officer must have sufficient resources and direct board access
- Article 12: Training must be specific, ongoing, appropriate to the role's functions and risks, and documented
- Article 13: Staff in AML roles must be assessed for skills, knowledge, and integrity before starting and regularly thereafter

RISK DIMENSIONS
Score every role across five dimensions on a Low / Medium / High / Critical scale:
1. AML Risk — risk of facilitating money laundering through this role's activities
2. Sanctions Risk — risk of transacting with sanctioned parties
3. Fraud Risk — risk of enabling or missing fraud
4. Documentation Risk — risk that poor record-keeping weakens the audit trail
5. Escalation Risk — risk that suspicious activity is not escalated in time

TRAINING STRUCTURE
All plans follow a 4-quarter annual format:
Q1 Foundation: core knowledge, regulatory framework, role-specific awareness
Q2 Application: practical skills, independent work, peer review
Q3 Deepening: advanced typologies, specialist workshops, cross-team collaboration
Q4 Embedding: regulatory updates, full competency assessment, year 2 planning

OUTPUT RULES
1. Every training module MUST include a justification field explaining why it was assigned
   to this specific role. Reference the exact risk dimension and AMLR article that drive it.
2. Never assign a module without a justification. Explainability is the core value of this product.
3. Frame all outputs as proposals for human review — a compliance officer will approve before anything is assigned.
4. Use precise compliance terminology: EDD not "detailed checks", SAR not "report", MLRO not "compliance manager".
5. When uncertain about a regulatory mapping, state your reasoning and flag it for human review.
6. Output ONLY valid JSON matching the exact schema requested. No markdown fences, no commentary outside JSON.`;

export const ROLE_ANALYSIS_USER = `Analyse this role description and produce a structured role profile.
Extract: role title, line of defence (1LoD or 2LoD), summary of daily activities,
key decisions this person makes, and what the consequence is if they make a wrong decision.

Also classify this role against these five known AMLR role archetypes:
- Customer Advisor (1LoD frontline): handles customer enquiries, onboarding, ID verification
- KYC Analyst (1LoD specialist): EDD on high-risk customers, SoF/SoW assessment, PEP screening
- TM Analyst (1LoD investigative): reviews transaction monitoring alerts, decides to escalate as SAR
- AML DDI Manager (2LoD management): manages KYC/AML team, third-party risk, GDPR data register
- MLRO (2LoD senior): SAR submission accountability, board reporting, regulatory engagement

Return the best match with a confidence score (0-1).

Return ONLY this JSON (no markdown, no other text):
{
  "role_title": "...",
  "line_of_defence": "1LoD" or "2LoD",
  "classified_as": one of ["Customer Advisor","KYC Analyst","TM Analyst","AML DDI Manager","MLRO","other"],
  "classification_confidence": 0.0-1.0,
  "daily_activities": "...",
  "key_decisions": "...",
  "mistake_consequences": "..."
}`;

export const RISK_ASSESSMENT_USER = `Given this role profile, produce a risk matrix.
Score each of these 5 dimensions on Low / Medium / High / Critical:
1. AML Risk
2. Sanctions Risk
3. Fraud Risk
4. Documentation Risk
5. Escalation Risk

For each score provide one sentence explaining why this role carries that level of risk.

Return ONLY this JSON array (no markdown, no other text):
[
  { "dimension": "AML Risk", "score": "Low|Medium|High|Critical", "justification": "..." },
  { "dimension": "Sanctions Risk", "score": "Low|Medium|High|Critical", "justification": "..." },
  { "dimension": "Fraud Risk", "score": "Low|Medium|High|Critical", "justification": "..." },
  { "dimension": "Documentation Risk", "score": "Low|Medium|High|Critical", "justification": "..." },
  { "dimension": "Escalation Risk", "score": "Low|Medium|High|Critical", "justification": "..." }
]`;

export const AMLR_MAPPING_USER = `Given this role profile and risk matrix, identify which AMLR 2024/1624 articles
impose training obligations relevant to this role. For each article state:
1. The article number and title
2. Why it applies to this specific role
3. What specific training obligation it creates

Focus on Articles 9, 10, 11, 12, and 13. Only use articles 9-15 from AMLR 2024/1624.

Return ONLY this JSON array (no markdown, no other text):
[
  {
    "article": "Article 9",
    "article_name": "Scope of internal policies, procedures and controls",
    "applies_because": "...",
    "training_obligation": "..."
  }
]`;

export const TRAINING_PLAN_USER = `Generate a 4-quarter (Q1-Q4) training plan for this role.
Include 5-7 modules per quarter following this structure:
- Q1 Foundation (months 1-3): core knowledge and awareness
- Q2 Application (months 4-6): practical skills and independent work
- Q3 Deepening (months 7-9): advanced topics and specialist knowledge
- Q4 Embedding (months 10-12): assessment, regulatory updates, year 2 planning

For each module provide:
- module_name
- duration_hours (estimated hours)
- risk_dimension (which risk dimension from the risk matrix this addresses)
- amlr_article (which AMLR article mandates or supports this module)
- why_included (one sentence explaining WHY this module is assigned to this role specifically)

Use the regulatory excerpt text provided to ensure accurate article references.
Every module MUST have a why_included justification. Return ONLY valid JSON (no markdown):

{
  "role_title": "...",
  "training_philosophy": "...",
  "quarters": [
    {
      "quarter": "Q1",
      "name": "Foundation",
      "months": "Months 1-3",
      "modules": [
        {
          "module_name": "...",
          "duration_hours": 4,
          "risk_dimension": "AML Risk",
          "amlr_article": "Article 12",
          "why_included": "..."
        }
      ]
    },
    { "quarter": "Q2", "name": "Application", "months": "Months 4-6", "modules": [] },
    { "quarter": "Q3", "name": "Deepening", "months": "Months 7-9", "modules": [] },
    { "quarter": "Q4", "name": "Embedding", "months": "Months 10-12", "modules": [] }
  ]
}`;
