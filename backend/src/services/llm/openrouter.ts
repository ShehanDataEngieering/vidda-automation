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
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';
