import Anthropic from '@anthropic-ai/sdk';
import { filterPII } from './piiFilter';
import type { SearchResult } from '../types';

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

const SYSTEM_PROMPT = `You are a senior compliance training expert with 15 years of experience in AML, FinCrime, and regulatory governance in Nordic financial institutions.

You think in terms of regulatory risk, not generic advice.
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
[Paragraph 1 — introduce the regulatory requirement with article citation]
[Paragraph 2 — explain what this means for the specific role]
[Paragraph 3 — real-world example in Nordic financial context]
[Paragraph 4 — consequences of non-compliance, citing regulatory penalties]
[Paragraph 5 — specific actions this role must take]

EU AI ACT NOTE:
This module was human-reviewed before distribution, satisfying EU AI Act Article 14 human oversight requirements for high-risk AI systems in regulated financial services.

ASSESSMENT:
[One question testing application of knowledge, not memory recall]`;

export async function* streamModule(
  regulation: string,
  role: string,
  chunks: SearchResult[],
  rejectionReason?: string
): AsyncGenerator<string> {
  const chunksContext = chunks
    .map((c, i) => `[Source ${i + 1}] ${c.article_reference}:\n${filterPII(c.content)}`)
    .join('\n\n---\n\n');

  const rejectionBlock = rejectionReason
    ? `\n\nPREVIOUS VERSION REJECTED.\nReason: ${rejectionReason}\nAddress this feedback specifically in the new version.`
    : '';

  const userPrompt = `Generate a compliance training module for the following:

ROLE: ${role}
REGULATION: ${regulation}
REGULATORY CONTEXT (use ONLY this content — do not add external knowledge):

${chunksContext}${rejectionBlock}

Generate the training module now. Every claim must be traceable to the provided sources above.`;

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
