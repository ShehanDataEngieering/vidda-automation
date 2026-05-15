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
