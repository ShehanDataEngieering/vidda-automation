import { Router, Request, Response } from 'express';
import { requireSignedIn, requireRole } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { db as pool } from '../db/client';

export const trainingRouter = Router();

trainingRouter.use(requireSignedIn, requireRole('employee'));

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

// Mark a module as in_progress or completed (3-state status)
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
