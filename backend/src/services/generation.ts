/**
 * Streams a Claude-generated training module as an async generator of text chunks.
 *
 * `anthropic` is injected rather than imported so this function is unit-testable
 * without a live API call — tests pass a mock that yields controlled text deltas.
 *
 * The system prompt enforces a strict output format with mandatory article citations.
 * This grounds the module in real regulatory text rather than hallucinated content.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages/messages';
import type { Chunk } from './vectorSearch';

const SYSTEM_PROMPT = `You are a compliance training expert. Generate training modules using ONLY the provided regulatory excerpts. Every claim must reference a specific article. Format strictly as:
TITLE: [module title]
OBJECTIVES:
- [objective 1]
- [objective 2]
- [objective 3]
CONTENT:
[paragraph 1 with article citation]
[paragraph 2 with article citation]
[paragraph 3 with article citation]
[paragraph 4 with article citation]
[paragraph 5 with article citation]
ASSESSMENT:
[one question testing key concepts]`;

export async function* streamModule(
  anthropic: Anthropic,
  regulation: string,
  role: string,
  chunks: Chunk[],
  rejectionReason?: string
): AsyncGenerator<string> {
  // Inject retrieved chunks as inline context so every generated claim
  // can be traced back to a specific article in the source material
  const chunksText = chunks
    .map((c) => `[${c.article_reference}]: ${c.content}`)
    .join('\n\n');

  const parts = [
    `Generate a compliance training module for the following role: ${role}`,
    `Regulation: ${regulation}`,
    '',
    'Regulatory excerpts to base the module on:',
    chunksText,
  ];

  // When regenerating after rejection, append the reviewer's reason so Claude
  // can address the specific concern rather than producing the same output again
  if (rejectionReason) {
    parts.push(
      `\nPrevious version was rejected — please address this: ${rejectionReason}`
    );
  }

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: parts.join('\n') }],
  });

  // Use the SDK's MessageStreamEvent type for proper discriminated narrowing
  for await (const event of stream as AsyncIterable<MessageStreamEvent>) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
