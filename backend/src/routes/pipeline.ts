import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { openrouter, DEFAULT_MODEL, FALLBACK_MODEL } from '../services/llm/openrouter';
import { PIPELINE_SYSTEM_PROMPT, ROLE_ANALYSIS_USER } from '../services/llm/pipelinePrompt';
import { validateRoleProfile } from '../services/llm/pipelineValidator';
import { logger } from '../utils/logger';
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

// ===========================================================================
// Step 1+2: Role Import + Role Analysis
// User pastes a role description → AI extracts structured profile + classifies
// ===========================================================================

pipelineRouter.post('/:id/analyze-role', async (req: Request, res: Response) => {
  const { roleDescription } = req.body;
  if (!roleDescription?.trim()) {
    res.status(400).json({ error: 'roleDescription is required' });
    return;
  }

  // Verify plan exists
  const { rows: plans } = await db.query(
    `SELECT id, version FROM training_plans WHERE id = $1`,
    [req.params.id],
  );
  if (!plans[0]) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const planId = req.params.id;
  const userPrompt = `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}`;

  try {
    // Phase 1: Try primary model
    let rawOutput: string;
    try {
      const message = await openrouter.chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: 600,
        temperature: 0.1,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      rawOutput = message.choices[0]?.message?.content ?? '{}';
    } catch (err) {
      logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
      const message = await openrouter.chat.completions.create({
        model: FALLBACK_MODEL,
        max_tokens: 600,
        temperature: 0.1,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      rawOutput = message.choices[0]?.message?.content ?? '{}';
    }

    // Phase 2: Validate + retry on failure
    let validation = validateRoleProfile(rawOutput);
    if (!validation.valid) {
      logger.warn('Role analysis first attempt invalid, retrying with strict mode');
      const retryMessage = await openrouter.chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: 600,
        temperature: 0.0,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON object specified. No markdown, no other text.' },
          { role: 'user', content: userPrompt },
        ],
      });
      const retryOutput = retryMessage.choices[0]?.message?.content ?? '{}';
      validation = validateRoleProfile(retryOutput);
    }

    if (!validation.valid || !validation.data) {
      res.status(500).json({ error: 'Role analysis failed to produce valid JSON after retry', warnings: validation.warnings });
      return;
    }

    // Save to DB
    await db.query(
      `UPDATE training_plans
       SET role_title = $1, role_description = $2, line_of_defence = $3,
           role_profile = $4, current_step = 'risk', updated_at = NOW()
       WHERE id = $5`,
      [
        validation.data.role_title,
        roleDescription,
        validation.data.line_of_defence,
        JSON.stringify(validation.data),
        planId,
      ],
    );

    // Write audit event
    await db.query(
      `INSERT INTO plan_events (plan_id, version, step, action, after_state)
       VALUES ($1, $2, 'role', 'ai_generated', $3)`,
      [planId, plans[0].version, JSON.stringify(validation.data)],
    );

    logger.info('Role analysis complete', { planId, classified_as: validation.data.classified_as });

    res.json({
      roleProfile: validation.data,
      warnings: validation.warnings,
      nextStep: 'risk',
    });
  } catch (err) {
    logger.error('Role analysis failed', { error: String(err) });
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

export default pipelineRouter;
