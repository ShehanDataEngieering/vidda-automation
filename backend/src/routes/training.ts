import { Router, Request, Response } from 'express';
import { requireSignedIn, requireRole } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { db as pool } from '../db/client';
import { generateQuiz } from '../services/llm/quizGeneration';
import { streamModuleAnswer } from '../services/llm/moduleChat';
import type { QuizQuestion } from '../services/llm/quizGeneration';

export const trainingRouter = Router();

trainingRouter.use(requireSignedIn, requireRole('employee'));

/**
 * GET /api/training/my-modules
 * Returns approved training modules for the employee's role, with completion status.
 */
trainingRouter.get('/my-modules', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT
       tm.id,
       tm.regulation,
       tm.role,
       tm.content,
       tm.quality_score,
       tm.rationale,
       tm.risk_dimensions,
       tm.created_at,
       mc.completed_at
     FROM training_modules tm
     LEFT JOIN module_completions mc
       ON mc.module_id = tm.id AND mc.user_id = $1
     WHERE tm.company_id = $2
       AND tm.status = 'approved'
       AND tm.role = $3
     ORDER BY tm.regulation, tm.created_at`,
    [user.userId, user.companyId, user.employeeRole ?? ''],
  );
  res.json(rows);
});

/**
 * POST /api/training/my-modules/:id/complete
 * Mark a module as completed (idempotent).
 */
trainingRouter.post('/my-modules/:id/complete', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  // Verify the module exists and belongs to this company
  const { rows: mod } = await pool.query(
    `SELECT id FROM training_modules WHERE id = $1 AND company_id = $2 AND status = 'approved'`,
    [req.params.id, user.companyId],
  );
  if (!mod[0]) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  const { rows } = await pool.query<{ completed_at: string }>(
    `INSERT INTO module_completions (user_id, module_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, module_id) DO UPDATE SET completed_at = NOW()
     RETURNING completed_at`,
    [user.userId, req.params.id],
  );

  res.json({ ok: true, completed_at: rows[0].completed_at });
});

/**
 * GET /api/training/my-progress
 * Summary: total modules, completed, breakdown by regulation.
 */
trainingRouter.get('/my-progress', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT
       tm.regulation,
       COUNT(*) AS total,
       COUNT(mc.id) AS completed
     FROM training_modules tm
     LEFT JOIN module_completions mc
       ON mc.module_id = tm.id AND mc.user_id = $1
     WHERE tm.company_id = $2
       AND tm.status = 'approved'
       AND tm.role = $3
     GROUP BY tm.regulation
     ORDER BY tm.regulation`,
    [user.userId, user.companyId, user.employeeRole ?? ''],
  );

  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const completed = rows.reduce((s, r) => s + Number(r.completed), 0);

  res.json({
    total,
    completed,
    byRegulation: rows.map(r => ({
      regulation: r.regulation,
      total: Number(r.total),
      completed: Number(r.completed),
    })),
  });
});

/**
 * GET /api/training/my-modules/:id/quiz
 * Returns cached quiz questions, or generates + caches them on first call (~10s).
 */
trainingRouter.get('/my-modules/:id/quiz', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const moduleId = req.params.id;

  // Verify module belongs to this company
  const { rows: mods } = await pool.query<{ content: string; regulation: string; role: string }>(
    `SELECT content, regulation, role FROM training_modules
     WHERE id = $1 AND company_id = $2 AND status = 'approved'`,
    [moduleId, user.companyId],
  );
  const mod = mods[0];
  if (!mod) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  // Return cached quiz if it exists
  const { rows: cached } = await pool.query<{ questions: QuizQuestion[] }>(
    `SELECT questions FROM module_quizzes WHERE module_id = $1`,
    [moduleId],
  );
  if (cached[0]) {
    res.json({ questions: cached[0].questions });
    return;
  }

  // Generate fresh quiz
  try {
    const questions = await generateQuiz(mod.content ?? '', mod.regulation, mod.role);

    // Cache it
    await pool.query(
      `INSERT INTO module_quizzes (module_id, questions)
       VALUES ($1, $2)
       ON CONFLICT (module_id) DO UPDATE SET questions = $2`,
      [moduleId, JSON.stringify(questions)],
    );

    res.json({ questions });
  } catch (err) {
    console.error('[quiz] Generation error:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

/**
 * POST /api/training/my-modules/:id/quiz/submit
 * Scores a quiz submission. If score >= 70, marks module complete.
 */
trainingRouter.post('/my-modules/:id/quiz/submit', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const moduleId = req.params.id;
  const { answers } = req.body as { answers: Record<string, string> };

  // Load cached quiz
  const { rows } = await pool.query<{ questions: QuizQuestion[] }>(
    `SELECT questions FROM module_quizzes WHERE module_id = $1`,
    [moduleId],
  );
  const quiz = rows[0];
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found — call GET /quiz first' });
    return;
  }

  const questions = quiz.questions;
  let correct = 0;
  const results = questions.map((q, i) => {
    const key = `q${i}`;
    const given = answers[key] ?? '';
    const isCorrect = given === q.correct;
    if (isCorrect) correct++;
    return {
      question: q.question,
      yourAnswer: given,
      correctAnswer: q.correct,
      isCorrect,
      explanation: q.explanation,
      options: q.options,
    };
  });

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= 70;

  // Store attempt
  await pool.query(
    `INSERT INTO quiz_attempts (module_id, user_id, answers, score, passed)
     VALUES ($1, $2, $3, $4, $5)`,
    [moduleId, user.userId, JSON.stringify(answers), score, passed],
  );

  // Auto-complete module on pass
  let completedAt: string | null = null;
  if (passed) {
    const { rows: comp } = await pool.query<{ completed_at: string }>(
      `INSERT INTO module_completions (user_id, module_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, module_id) DO UPDATE SET completed_at = NOW()
       RETURNING completed_at`,
      [user.userId, moduleId],
    );
    completedAt = comp[0]?.completed_at ?? null;
  }

  res.json({ score, passed, completedAt, results });
});

/**
 * POST /api/training/my-modules/:id/ask
 * SSE stream: Claude answers a question grounded in the module content.
 */
trainingRouter.post('/my-modules/:id/ask', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const moduleId = req.params.id;
  const { question } = req.body as { question: string };

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  const { rows: mods } = await pool.query<{ content: string; regulation: string; role: string }>(
    `SELECT content, regulation, role FROM training_modules
     WHERE id = $1 AND company_id = $2 AND status = 'approved'`,
    [moduleId, user.companyId],
  );
  const mod = mods[0];
  if (!mod) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    for await (const token of streamModuleAnswer(question, mod.content ?? '', mod.regulation, mod.role)) {
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    console.error('[moduleChat] error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate answer' })}\n\n`);
  } finally {
    res.end();
  }
});

// ===========================================================================
// V6: LMS Employee View — my assigned AMLR training plan
// ===========================================================================

// Get employee's assigned plan with module details
trainingRouter.get('/my-plan', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT
       a.id, a.plan_id, a.module_index, a.quarter, a.due_date, a.status, a.completed_at,
       tp.role_title, tp.training_plan
     FROM plan_assignments a
     JOIN training_plans tp ON tp.id = a.plan_id
     WHERE a.user_id = $1
     ORDER BY a.quarter, a.module_index`,
    [user.userId],
  );

  // Enrich assignments with module details from the plan JSONB
  const enriched = rows.map(row => {
    const plan = typeof row.training_plan === 'string' ? JSON.parse(row.training_plan) : row.training_plan;
    let moduleDetail = null;
    for (const q of (plan.quarters ?? [])) {
      if (q.quarter === row.quarter && q.modules && q.modules[row.module_index]) {
        moduleDetail = q.modules[row.module_index];
        break;
      }
    }
    return {
      ...row,
      training_plan: undefined,
      module_name: moduleDetail?.module_name ?? `Module ${row.module_index + 1}`,
      risk_dimension: moduleDetail?.risk_dimension ?? '',
      amlr_article: moduleDetail?.amlr_article ?? '',
      why_included: moduleDetail?.why_included ?? '',
    };
  });

  res.json(enriched);
});

// Mark a module as in_progress or completed
trainingRouter.patch('/my-plan/:assignmentId', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { status } = req.body;
  if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
    res.status(400).json({ error: 'status must be not_started, in_progress, or completed' });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE plan_assignments
     SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
     WHERE id = $2 AND user_id = $3
     RETURNING id, status, completed_at`,
    [status, req.params.assignmentId, user.userId],
  );

  if (!rows[0]) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }
  res.json(rows[0]);
});
