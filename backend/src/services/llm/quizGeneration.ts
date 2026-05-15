import { openrouter, DEFAULT_MODEL, QUIZ_TEMPERATURE, FALLBACK_MODEL } from './openrouter';
import { logger } from '../../utils/logger';

export interface QuizQuestion {
  question: string;
  options: { a: string; b: string; c: string; d: string };
  correct: 'a' | 'b' | 'c' | 'd';
  explanation: string;
}

const QUIZ_SYSTEM = `You are a compliance training assessment designer for a licensed financial institution.
Your task is to generate scenario-based multiple-choice questions that test APPLIED knowledge — not memory recall.
Questions must present realistic workplace situations and require the learner to select the correct procedure.

STRICT FORMAT — output valid JSON only, no markdown, no commentary:
[
  {
    "question": "...",
    "options": { "a": "...", "b": "...", "c": "...", "d": "..." },
    "correct": "a",
    "explanation": "..."
  }
]

Rules:
- 4 questions exactly
- Each question is a scenario (starts with "Your customer...", "You receive...", "A colleague asks...", etc.)
- Distractors must be plausible but clearly incorrect given the training content
- Explanation references the specific article or section from the training module
- Pass threshold is 70% (3 of 4 correct)`;

function cleanupJson(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

async function tryGenerateQuiz(
  moduleContent: string,
  regulation: string,
  role: string,
  strictMode: boolean,
): Promise<string> {
  const extra = strictMode
    ? '\n\nCRITICAL: Output ONLY a raw JSON array. No markdown fences, no explanations, no other text. Start with [ and end with ].'
    : '';

  const userPrompt = `Generate 4 scenario-based quiz questions for this training module.

REGULATION: ${regulation}
ROLE: ${role}

TRAINING MODULE CONTENT:
${moduleContent.slice(0, 4000)}

Generate questions that test whether the employee can APPLY the correct procedure in real workplace situations.
Return ONLY the JSON array — no other text.${extra}`;

  try {
    const message = await openrouter.chat.completions.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      temperature: strictMode ? 0.2 : QUIZ_TEMPERATURE,
      messages: [
        { role: 'system', content: QUIZ_SYSTEM + extra },
        { role: 'user', content: userPrompt },
      ],
    });
    return message.choices[0]?.message?.content ?? '[]';
  } catch (err) {
    logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
    const message = await openrouter.chat.completions.create({
      model: FALLBACK_MODEL,
      max_tokens: 1500,
      temperature: strictMode ? 0.2 : QUIZ_TEMPERATURE,
      messages: [
        { role: 'system', content: QUIZ_SYSTEM + extra },
        { role: 'user', content: userPrompt },
      ],
    });
    return message.choices[0]?.message?.content ?? '[]';
  }
}

export async function generateQuiz(
  moduleContent: string,
  regulation: string,
  role: string,
): Promise<QuizQuestion[]> {
  const raw = await tryGenerateQuiz(moduleContent, regulation, role, false);

  try {
    const cleaned = cleanupJson(raw);
    const parsed = JSON.parse(cleaned) as QuizQuestion[];
    const validated = parsed.slice(0, 4).filter(q => q.question && q.options && q.correct && q.explanation);
    if (validated.length > 0) return validated;
    throw new Error('No valid questions after filtering');
  } catch (err) {
    logger.warn('Quiz generation first attempt failed, retrying in strict mode', { error: String(err) });

    try {
      const retryRaw = await tryGenerateQuiz(moduleContent, regulation, role, true);
      const cleaned = cleanupJson(retryRaw);
      const parsed = JSON.parse(cleaned) as QuizQuestion[];
      const validated = parsed.slice(0, 4).filter(q => q.question && q.options && q.correct && q.explanation);
      if (validated.length > 0) return validated;
      throw new Error('No valid questions found after retry');
    } catch (retryErr) {
      logger.error('Quiz generation failed after retry', { error: String(retryErr) });
      throw new Error('Quiz generation returned invalid JSON after retry');
    }
  }
}
