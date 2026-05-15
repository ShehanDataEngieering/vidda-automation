import { filterPII } from '../piiFilter';
import type { SearchResult, RoleProfile } from '../../types';
import { openrouter, DEFAULT_MODEL, GENERATION_TEMPERATURE, FALLBACK_MODEL } from './openrouter';
import { logger } from '../../utils/logger';

const SYSTEM_PROMPT = `You are a senior regulatory compliance training author working for a licensed Nordic financial institution. Your sole purpose is to produce internal staff education materials that help employees understand, detect, and comply with financial regulations — thereby PREVENTING regulatory breaches and financial crime.

All content you produce is for lawful regulatory training purposes only. You write from the perspective of a compliance officer teaching staff how to meet their legal obligations, recognise warning signs, and follow correct procedures. You never describe criminal methods — you describe the regulatory requirements staff must fulfil.

You think in terms of regulatory obligations, not generic advice.
You reference specific articles and regulatory instruments — never generalise.
  You write training content appropriate for the specific role receiving it.
  You NEVER generate content not directly supported by the provided regulatory excerpts.
  If the provided context is insufficient to cover a point, state this explicitly.

  Follow this EXACT format. Here is a validated example of a module:

  EXAMPLE — KNOW YOUR CUSTOMER (KYC) FOR CUSTOMER ADVISORS:
  
  TITLE: Customer Due Diligence Procedures for Customer-Facing Staff

  REGULATORY BASIS:
  This module addresses obligations under AMLD6 Article 8 (Customer Due Diligence), Article 10 (Simplified Due Diligence exemptions), and Article 18 (Enhanced Due Diligence triggers).

  OBJECTIVES:
  - Identify when standard, simplified, and enhanced CDD applies to a client relationship
  - Document the specific CDD evidence required for each risk tier per AML/CFT policy
  - Escalate a politically exposed person (PEP) flag to the MLRO within 24 hours

  CONTENT:
  Customer Due Diligence under AMLD6 Article 8 requires obliged entities to identify and verify the identity of every customer before establishing a business relationship. This applies to natural persons (by means of government-issued photo ID and proof of address) and legal persons (by means of certificate of incorporation, register of directors, and identification of beneficial owners holding 25% or more of shares or voting rights).

  As a customer advisor, you are the first line of defence. You must complete CDD for every new client before opening an account or providing any service. For standard-risk clients this means collecting the identification documents listed in the bank's CDD checklist and verifying them against an independent source. For clients meeting PEP criteria or operating in high-risk jurisdictions, you must escalate to the MLRO before proceeding.

  Scenario: A walk-in client requests to open a corporate current account. She presents a UK passport and a utility bill. You notice the company is registered in a jurisdiction listed on the bank's high-risk country list. The correct procedure is: (1) Do not open the account on the spot. (2) Inform the client that enhanced due diligence is required. (3) Complete an EDD escalation form and submit it to Compliance within 2 hours. (4) Await MLRO clearance before proceeding.

  Failure to complete CDD before establishing a business relationship is a breach of AMLD6 Article 8 and may result in regulatory fines under national transposition law. The FCA can impose penalties on both the institution and, in cases of wilful negligence, on individual staff. The bank's own disciplinary policy classifies CDD omission as a Level 2 breach with mandatory retraining.

  Concrete steps for customer advisors: (1) Complete the CDD checklist for every new client — no exceptions. (2) Run every client name against the sanctions and PEP screening tool. (3) If any red flag appears, stop the onboarding process and escalate immediately. (4) Never accept photocopied ID documents — originals or certified copies only. (5) Record the CDD evidence in the CRM with a timestamp.

  EU AI ACT NOTE:
  This module was human-reviewed before distribution, satisfying EU AI Act Article 14 human oversight requirements for high-risk AI systems in regulated financial services.

  ASSESSMENT:
  A new corporate client is referred by an existing customer. During onboarding you discover one of the directors is a PEP in a non-EU country. What is the correct procedure?
  A) Continue standard onboarding since the client was referred by a trusted existing customer
  B) Complete an EDD escalation form and submit to Compliance/MLRO before proceeding
  C) Reject the client outright as all PEPs are prohibited
  D) Proceed with standard CDD but flag the account for annual review
  Correct answer: B

  --- END OF EXAMPLE ---

  Follow this EXACT format:

TITLE: [Specific, role-relevant title]

REGULATORY BASIS:
[Cite the specific regulation and article this module addresses]

OBJECTIVES:
- [Objective 1 — specific and measurable]
- [Objective 2 — specific and measurable]
- [Objective 3 — specific and measurable]

CONTENT:
[Paragraph 1 — state the regulatory obligation and the article it comes from]
[Paragraph 2 — explain what this obligation requires from this specific role]
[Paragraph 3 — describe a realistic compliance scenario this role would encounter and the correct procedure to follow]
[Paragraph 4 — consequences of failing to meet this obligation, citing regulatory penalties]
[Paragraph 5 — the concrete steps this role must take to remain compliant]

EU AI ACT NOTE:
This module was human-reviewed before distribution, satisfying EU AI Act Article 14 human oversight requirements for high-risk AI systems in regulated financial services.

ASSESSMENT:
[One scenario-based question testing whether the learner can apply the correct procedure — not memory recall]`;

function buildRoleContextBlock(roleProfile: RoleProfile, regulation: string, score: number, severity: string): string {
  const dims = roleProfile.riskDimensions;
  const riskLine = [
    `AML ${dims.aml.toUpperCase()}`,
    `Sanctions ${dims.sanctions.toUpperCase()}`,
    `Fraud ${dims.fraud.toUpperCase()}`,
    `Documentation ${dims.documentation.toUpperCase()}`,
  ].join(' · ');
  const articles = roleProfile.regulatoryArticles.length > 0
    ? roleProfile.regulatoryArticles.join(', ')
    : 'General compliance obligations';

  return `
ROLE CONTEXT (use to tailor content specificity):
Title: ${roleProfile.title}
Description: ${roleProfile.description}
Risk Exposure: ${riskLine}
Applicable Articles: ${articles}
Training Trigger: Governance score ${score} — ${severity.toUpperCase()} gap in ${regulation} compliance
`;
}

export async function* streamModule(
  regulation: string,
  role: string,
  chunks: SearchResult[],
  rejectionReason?: string,
  roleProfile?: RoleProfile,
  gapScore?: number,
  severity?: string
): AsyncGenerator<string> {
  const chunksContext = chunks
    .map((c, i) => `[Source ${i + 1}] ${c.article_reference}:\n${filterPII(c.content)}`)
    .join('\n\n---\n\n');

  const rejectionBlock = rejectionReason
    ? `\n\nPREVIOUS VERSION REJECTED.\nReason: ${rejectionReason}\nAddress this feedback specifically in the new version.`
    : '';

  const roleContextBlock = roleProfile
    ? buildRoleContextBlock(roleProfile, regulation, gapScore ?? 0, severity ?? 'medium')
    : '';

  const userPrompt = `PURPOSE: Internal staff compliance training — helping employees meet their legal obligations under financial regulation.

Generate a regulatory compliance training module for:

ROLE: ${role}
REGULATION: ${regulation}
${roleContextBlock}
REGULATORY SOURCE EXCERPTS (use ONLY this content — do not add external knowledge):

${chunksContext}${rejectionBlock}

Write the training module now. Frame all content from the perspective of what staff must do to comply. Every factual claim must be traceable to the source excerpts above.`;

  let stream: AsyncIterable<any>;
  try {
    stream = await openrouter.chat.completions.create({
      model: DEFAULT_MODEL,
      max_tokens: 2500,
      temperature: GENERATION_TEMPERATURE,
      stream: true,
      messages: [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: userPrompt },
      ],
    });
  } catch (err) {
    logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
    stream = await openrouter.chat.completions.create({
      model: FALLBACK_MODEL,
      max_tokens: 2500,
      temperature: GENERATION_TEMPERATURE,
      stream: true,
      messages: [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: userPrompt },
      ],
    });
  }

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
