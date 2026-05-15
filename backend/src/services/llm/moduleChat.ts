import { filterPII } from '../piiFilter';
import { openrouter, DEFAULT_MODEL } from './openrouter';

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

  const stream = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: 400,
    stream: true,
    messages: [
      { role: 'system', content: MODULE_CHAT_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
