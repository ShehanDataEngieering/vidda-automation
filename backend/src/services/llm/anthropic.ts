import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';

// Direct Anthropic API — no OpenRouter middleman, billed via platform.claude.com.
export const anthropic = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
});

// Default model — change here to switch the whole app
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

export const GENERATION_TEMPERATURE = 0.3;
export const CHAT_TEMPERATURE = 0.1;
export const MODULE_CHAT_TEMPERATURE = 0.3;
export const QUIZ_TEMPERATURE = 0.5;

export interface CompletionParams {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  model?: string;
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | undefined)?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? '';
}

// One retry against the same model on a transient (429/5xx) failure — no cross-provider fallback.
export async function createCompletion(params: CompletionParams): Promise<string> {
  const { system, prompt, maxTokens, temperature, model = DEFAULT_MODEL } = params;
  const request = { model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user' as const, content: prompt }] };
  try {
    const message = await anthropic.messages.create(request);
    return extractText(message);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    logger.warn('Anthropic call failed, retrying once', { error: String(err) });
    const message = await anthropic.messages.create(request);
    return extractText(message);
  }
}

// Streams text deltas. Only retries if the failure happens before any tokens were emitted
// (matches the previous OpenRouter behavior) — a mid-stream failure after partial output is
// rethrown as-is, since retrying then would duplicate already-sent tokens to the client.
export async function* streamCompletion(params: CompletionParams): AsyncGenerator<string> {
  const { system, prompt, maxTokens, temperature, model = DEFAULT_MODEL } = params;
  const request = { model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user' as const, content: prompt }] };

  let yielded = false;
  try {
    const stream = anthropic.messages.stream(request);
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yielded = true;
        yield event.delta.text;
      }
    }
  } catch (err) {
    if (yielded || !isRetryable(err)) throw err;
    logger.warn('Anthropic stream failed before any output, retrying once', { error: String(err) });
    const stream = anthropic.messages.stream(request);
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
