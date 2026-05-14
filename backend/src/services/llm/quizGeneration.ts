import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

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

export async function generateQuiz(
  moduleContent: string,
  regulation: string,
  role: string,
): Promise<QuizQuestion[]> {
  const userPrompt = `Generate 4 scenario-based quiz questions for this training module.

REGULATION: ${regulation}
ROLE: ${role}

TRAINING MODULE CONTENT:
${moduleContent.slice(0, 4000)}

Generate questions that test whether the employee can APPLY the correct procedure in real workplace situations.
Return ONLY the JSON array — no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: QUIZ_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]';

  // Strip potential markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as QuizQuestion[];
    return parsed.slice(0, 4);
  } catch (err) {
    console.error('[quiz] Failed to parse quiz JSON:', err, '\nRaw:', raw);
    throw new Error('Quiz generation returned invalid JSON');
  }
}
