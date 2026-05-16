import { filterPII } from '../piiFilter';
import { openrouter, DEFAULT_MODEL, MODULE_CHAT_TEMPERATURE, FALLBACK_MODEL } from './openrouter';
import { logger } from '../../utils/logger';

const MODULE_CHAT_SYSTEM = `You are a compliance learning assistant embedded inside a specific training module.
Your ONLY knowledge source is the training module content provided in the user message.

Rules you cannot break:
1. Answer ONLY from the training module content below.
2. Keep answers concise: 2-4 sentences.
3. Reference the specific section or article when relevant.
4. If the question cannot be answered from the module content, respond ONLY with:
   "That topic isn't covered in this training module. Check the Compliance Chat for document-based answers."
5. Do not add external knowledge or speculate.`;

export async function* streamModuleAnswer(
  question: string,
  moduleContent: string,
  regulation: string,
  role: string,
): AsyncGenerator<string> {
  const safeQuestion = filterPII(question);

  const userPrompt = `TRAINING MODULE (${regulation} — ${role}):
${moduleContent.slice(0, 5000)}

EMPLOYEE QUESTION:
${safeQuestion}

Answer based ONLY on the module content above.`;

  let stream: AsyncIterable<any>;
  try {
    stream = await openrouter.chat.completions.create({
      model: DEFAULT_MODEL,
      max_tokens: 400,
      temperature: MODULE_CHAT_TEMPERATURE,
      stream: true,
      messages: [
        { role: 'system' as const, content: MODULE_CHAT_SYSTEM },
        { role: 'user' as const, content: userPrompt },
      ],
    });
  } catch (err) {
    logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
    stream = await openrouter.chat.completions.create({
      model: FALLBACK_MODEL,
      max_tokens: 400,
      temperature: MODULE_CHAT_TEMPERATURE,
      stream: true,
      messages: [
        { role: 'system' as const, content: MODULE_CHAT_SYSTEM },
        { role: 'user' as const, content: userPrompt },
      ],
    });
  }

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
