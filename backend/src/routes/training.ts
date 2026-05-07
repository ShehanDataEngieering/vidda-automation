import { Router, Request, Response } from 'express';
import { requireSignedIn, requireRole } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { db as pool } from '../db/client';

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
