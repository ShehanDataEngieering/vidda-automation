import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import type { PipelinePlan } from '../types';

// ===========================================================================
// Pipeline Router — AMLR 7-step training plan generator
// Routes: POST / (create plan), GET /:id (fetch plan state)
// Additional step-specific routes come in branches 1-4
// ===========================================================================

export const pipelineRouter = Router();

// Fetch a plan's full state — all JSONB columns returned as-is
// The frontend refetches this after every step to get updated current_step
pipelineRouter.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await db.query<PipelinePlan>(
    `SELECT
       id, company_id, created_by,
       role_title, role_description, line_of_defence,
       role_profile, risk_matrix, amlr_mappings, training_plan,
       current_step, version, status, reviewer,
       created_at, updated_at
     FROM training_plans WHERE id = $1`,
    [req.params.id],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  res.json(rows[0]);
});

// Create an empty plan — just companyId + userId, all step data is null
// The user immediately goes to Step 1 (role import) after creation
pipelineRouter.post('/', async (req: Request, res: Response) => {
  const { companyId, createdBy } = req.body;
  if (!companyId) {
    res.status(400).json({ error: 'companyId is required' });
    return;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO training_plans (company_id, created_by) VALUES ($1, $2) RETURNING id`,
    [companyId, createdBy ?? 'unknown'],
  );
  res.status(201).json({ planId: rows[0].id });
});

export default pipelineRouter;
