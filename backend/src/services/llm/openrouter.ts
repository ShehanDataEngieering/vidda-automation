import OpenAI from 'openai';

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
