import OpenAI from 'openai';
import { logger } from '../../utils/logger';

// OpenRouter is OpenAI-API compatible — just swap baseURL + API key
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://vidda.ai',
    'X-Title': 'Vidda Compliance',
  },
});

// Default model — change here to switch the whole app
export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-5';
export const FALLBACK_MODEL = 'google/gemini-2.5-flash';

export const GENERATION_TEMPERATURE = 0.3;
export const CHAT_TEMPERATURE = 0.1;
export const MODULE_CHAT_TEMPERATURE = 0.3;
export const QUIZ_TEMPERATURE = 0.5;

export async function createCompletionWithFallback(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await openrouter.chat.completions.create(params);
  } catch (err: unknown) {
    const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
    if ((status === 429 || (typeof status === 'number' && status >= 500)) && params.model !== FALLBACK_MODEL) {
      logger.warn(`Primary model ${params.model} failed (${status}), falling back to ${FALLBACK_MODEL}`);
      return openrouter.chat.completions.create({ ...params, model: FALLBACK_MODEL });
    }
    throw err;
  }
}

export async function createStreamWithFallback(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  try {
    return await openrouter.chat.completions.create(params);
  } catch (err: unknown) {
    const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
    if ((status === 429 || (typeof status === 'number' && status >= 500)) && params.model !== FALLBACK_MODEL) {
      logger.warn(`Primary model ${params.model} failed (${status}), falling back to ${FALLBACK_MODEL}`);
      return openrouter.chat.completions.create({ ...params, model: FALLBACK_MODEL });
    }
    throw err;
  }
}
