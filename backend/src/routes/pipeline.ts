import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { openrouter, DEFAULT_MODEL, FALLBACK_MODEL } from '../services/llm/openrouter';
import { PIPELINE_SYSTEM_PROMPT, ROLE_ANALYSIS_USER, RISK_ASSESSMENT_USER, AMLR_MAPPING_USER, TRAINING_PLAN_USER } from '../services/llm/pipelinePrompt';
import { validateRoleProfile, validateRiskMatrix, validateAMLRMappings, validateTrainingPlan } from '../services/llm/pipelineValidator';
import { searchChunks } from '../services/rag/vectorSearch';
import { logger } from '../utils/logger';
import { getUserContext } from '../utils/user';
import { requireSignedIn, requireRole } from '../middleware/auth';
import type { PipelinePlan } from '../types';

// ===========================================================================
// Pipeline Router — AMLR 7-step training plan generator
// All routes require signed-in Clerk session + admin role + company scoping
// ===========================================================================

export const pipelineRouter = Router();

// ── Auth gates ──
// Every pipeline route needs signed-in user + admin role
pipelineRouter.use(requireSignedIn, requireRole('admin'));

// Helper: enforce company scoping + fetch plan
async function getScopedPlan(req: Request, res: Response):
  Promise<{ ctx: { userId: string; companyId: string; role: 'admin' | 'employee' }; planRow: PipelinePlan } | null> {
  const ctx = await getUserContext(req, res);
  if (!ctx) return null;
  const id = req.params.id;
  if (!id || id === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.status(400).json({ error: 'Invalid plan ID' });
    return null;
  }
  const { rows } = await db.query<PipelinePlan>(
    `SELECT * FROM training_plans WHERE id = $1 AND company_id = $2`,
    [id, ctx.companyId],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Plan not found or access denied' });
    return null;
  }
  return { ctx, planRow: rows[0] };
}

// ===========================================================================
// LIST: all plans for this admin's company
// ===========================================================================

pipelineRouter.get('/', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { rows } = await db.query<PipelinePlan>(
    `SELECT
       id, company_id, created_by,
       role_title, role_description, line_of_defence,
       role_profile, risk_matrix, amlr_mappings, training_plan,
       current_step, version, status, reviewer,
       created_at, updated_at
     FROM training_plans
     WHERE company_id = $1
     ORDER BY updated_at DESC`,
    [ctx.companyId],
  );
  res.json(rows);
});

// ===========================================================================
// CREATE empty plan (static route BEFORE dynamic /:id)
// ===========================================================================

pipelineRouter.post('/', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO training_plans (company_id, created_by) VALUES ($1, $2) RETURNING id`,
    [ctx.companyId, ctx.userId],
  );
  res.status(201).json({ planId: rows[0].id });
});

// ===========================================================================
// Admin dashboard: all assignments across company plans
// MUST be before /:id so Express doesn't match "assignments" as an id
// ===========================================================================

pipelineRouter.get('/assignments/all', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { rows } = await db.query(
    `SELECT
       a.id, a.plan_id, a.user_id, a.module_index, a.quarter,
       a.due_date, a.status, a.completed_at,
       tp.role_title
     FROM plan_assignments a
     JOIN training_plans tp ON tp.id = a.plan_id
     WHERE tp.company_id = $1
     ORDER BY a.status, a.quarter, a.module_index`,
    [ctx.companyId],
  );
  res.json(rows);
});

// ===========================================================================
// Approved plans (public within company)
// MUST be before /:id so Express doesn't match "plans" as an id
// ===========================================================================

pipelineRouter.get('/plans/approved', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { rows } = await db.query(
    `SELECT id, role_title, line_of_defence, training_plan, reviewer, updated_at, status
     FROM training_plans
     WHERE company_id = $1 AND status = 'approved'
     ORDER BY updated_at DESC`,
    [ctx.companyId],
  );
  res.json(rows);
});

// ===========================================================================
// FETCH single plan state — DYNAMIC routes after all static ones
// ===========================================================================

pipelineRouter.get('/:id', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  res.json(result.planRow);
});

// ===========================================================================
// Step 1 — save raw role description (before AI analysis or with clarifications)
// ===========================================================================

pipelineRouter.patch('/:id/role', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow, ctx } = result;

  const { roleDescription, roleProfile } = req.body;
  const newVersion = planRow.version + 1;

  await db.query(
    `UPDATE training_plans
     SET role_description = COALESCE($1, role_description),
         role_profile = COALESCE($2, role_profile),
         version = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [roleDescription ?? null, roleProfile ? JSON.stringify(roleProfile) : null, newVersion, planRow.id],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, after_state)
     VALUES ($1, $2, 'role', 'human_override', $3, $4)`,
    [planRow.id, newVersion, ctx.userId, JSON.stringify({ roleDescription, roleProfile })],
  );

  res.json({ ok: true, version: newVersion });
});

// ===========================================================================
// Step 1+2: Role Import + Role Analysis
// ===========================================================================

pipelineRouter.post('/:id/analyze-role', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;

  const { planRow } = result;
  const { roleDescription } = req.body;
  if (!roleDescription?.trim()) {
    res.status(400).json({ error: 'roleDescription is required' });
    return;
  }

  const planId = req.params.id;
  const userPrompt = `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}`;

  try {
    let rawOutput: string;
    try {
      const message = await openrouter.chat.completions.create({
        model: DEFAULT_MODEL, max_tokens: 600, temperature: 0.1,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      rawOutput = message.choices[0]?.message?.content ?? '{}';
    } catch (err) {
      logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
      const message = await openrouter.chat.completions.create({
        model: FALLBACK_MODEL, max_tokens: 600, temperature: 0.1,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      rawOutput = message.choices[0]?.message?.content ?? '{}';
    }

    let validation = validateRoleProfile(rawOutput);
    if (!validation.valid) {
      logger.warn('Role analysis first attempt invalid, retrying');
      const retryMessage = await openrouter.chat.completions.create({
        model: DEFAULT_MODEL, max_tokens: 600, temperature: 0.0,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON object. No markdown.' },
          { role: 'user', content: userPrompt },
        ],
      });
      validation = validateRoleProfile(retryMessage.choices[0]?.message?.content ?? '{}');
    }

    if (!validation.valid || !validation.data) {
      res.status(500).json({ error: 'Role analysis failed after retry', warnings: validation.warnings });
      return;
    }

    await db.query(
      `UPDATE training_plans
       SET role_title = $1, role_description = $2, line_of_defence = $3,
           role_profile = $4, current_step = 'risk', updated_at = NOW()
       WHERE id = $5`,
      [validation.data.role_title, roleDescription, validation.data.line_of_defence, JSON.stringify(validation.data), planId],
    );

    await db.query(
      `INSERT INTO plan_events (plan_id, version, step, action, after_state)
       VALUES ($1, $2, 'role', 'ai_generated', $3)`,
      [planId, planRow.version, JSON.stringify(validation.data)],
    );

    logger.info('Role analysis complete', { planId, classified_as: validation.data.classified_as });
    res.json({ roleProfile: validation.data, warnings: validation.warnings, nextStep: 'risk' });
  } catch (err) {
    logger.error('Role analysis failed', { error: String(err) });
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// ===========================================================================
// Helper: AI call with fallback
// ===========================================================================

async function callAIWithRetry(systemPrompt: string, userPrompt: string, maxTokens = 600, temperature = 0.1): Promise<string> {
  try {
    const message = await openrouter.chat.completions.create({
      model: DEFAULT_MODEL, max_tokens: maxTokens, temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return message.choices[0]?.message?.content ?? '{}';
  } catch (err) {
    logger.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}`, { error: String(err) });
    const message = await openrouter.chat.completions.create({
      model: FALLBACK_MODEL, max_tokens: maxTokens, temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return message.choices[0]?.message?.content ?? '{}';
  }
}

// ===========================================================================
// Step 3: Risk Assessment
// ===========================================================================

pipelineRouter.post('/:id/assess-risk', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow } = result;

  if (!planRow.role_profile) {
    res.status(400).json({ error: 'Role not analysed yet. Run analyze-role first.' });
    return;
  }

  const planId = req.params.id;
  const roleJson = JSON.stringify(planRow.role_profile);
  const userPrompt = `${RISK_ASSESSMENT_USER}\n\nROLE PROFILE:\n${roleJson}`;

  try {
    let rawOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT, userPrompt, 800, 0.1);
    let validation = validateRiskMatrix(rawOutput);
    if (!validation.valid) {
      logger.warn('Risk matrix first attempt invalid, retrying');
      const retryOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT + '\nCRITICAL: Output ONLY the JSON array. No markdown.', userPrompt, 800, 0.0);
      validation = validateRiskMatrix(retryOutput);
    }

    if (!validation.valid || !validation.data) {
      res.status(500).json({ error: 'Risk assessment failed', warnings: validation.warnings });
      return;
    }

    await db.query(
      `UPDATE training_plans SET risk_matrix = $1, current_step = 'risk', updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(validation.data), planId],
    );

    await db.query(
      `INSERT INTO plan_events (plan_id, version, step, action, after_state)
       VALUES ($1, $2, 'risk', 'ai_generated', $3)`,
      [planId, planRow.version, JSON.stringify(validation.data)],
    );

    logger.info('Risk assessment complete', { planId });
    res.json({ riskMatrix: validation.data, warnings: validation.warnings, nextStep: 'amlr' });
  } catch (err) {
    logger.error('Risk assessment failed', { error: String(err) });
    res.status(500).json({ error: 'AI risk assessment failed' });
  }
});

// ===========================================================================
// Gate 1: Human Risk Review (override)
// ===========================================================================

pipelineRouter.patch('/:id/risk', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow, ctx } = result;

  if (!planRow.risk_matrix) {
    res.status(400).json({ error: 'Risk not assessed yet.' });
    return;
  }

  const { overrides, reviewerNote } = req.body;
  const beforeState = planRow.risk_matrix;
  let riskMatrix = typeof beforeState === 'string' ? JSON.parse(beforeState) : beforeState;

  if (overrides && typeof overrides === 'object') {
    riskMatrix = riskMatrix.map((dim: { dimension: string; score?: string; justification?: string }) => {
      const override = overrides[dim.dimension];
      if (override) return { ...dim, score: override.score, justification: override.justification || dim.justification };
      return dim;
    });
  }

  const newVersion = planRow.version + 1;
  await db.query(
    `UPDATE training_plans SET risk_matrix = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(riskMatrix), newVersion, planRow.id],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, before_state, after_state, note)
     VALUES ($1, $2, 'risk', 'human_override', $3, $4, $5, $6)`,
    [planRow.id, newVersion, ctx.userId, JSON.stringify(beforeState), JSON.stringify(riskMatrix), reviewerNote ?? null],
  );

  res.json({ riskMatrix, version: newVersion, nextStep: 'amlr' });
});

// ===========================================================================
// Step 4: AMLR Article Mapping (RAG)
// ===========================================================================

async function executeAMLRMapping(planRow: PipelinePlan): Promise<{ mappings: unknown[]; warnings: string[] } | null> {
  if (!planRow.role_profile || !planRow.risk_matrix) return null;

  const planId = planRow.id;
  const roleProfile = typeof planRow.role_profile === 'string' ? JSON.parse(planRow.role_profile) : planRow.role_profile;
  const roleTitle = roleProfile.role_title || roleProfile.classified_as || 'this role';

  let articleExcerpts = '';
  try {
    const searchResults = await searchChunks('AMLR', roleTitle, 8);
    articleExcerpts = searchResults.map((r, i) => `[Excerpt ${i + 1} — AMLR ${r.article_reference}]\n${r.content}`).join('\n\n');
  } catch (err) {
    logger.warn('RAG retrieval failed', { error: String(err) });
  }

  const userPrompt = `${AMLR_MAPPING_USER}\n\nROLE PROFILE AND RISK MATRIX:\n${JSON.stringify(roleProfile, null, 2)}\n${JSON.stringify(planRow.risk_matrix, null, 2)}\n\nREGULATORY EXCERPTS:\n${articleExcerpts}`;
  let rawOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT, userPrompt, 3000, 0.1);

  let validation = validateAMLRMappings(rawOutput);
  if (!validation.valid) {
    const retryOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT + '\nCRITICAL: Output ONLY the JSON array. Only AMLR Articles 9-15. No markdown.', userPrompt, 3000, 0.0);
    validation = validateAMLRMappings(retryOutput);
  }

  if (!validation.valid || !validation.data) return null;

  await db.query(
    `UPDATE training_plans SET amlr_mappings = $1, current_step = 'amlr', updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(validation.data), planId],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, after_state)
     VALUES ($1, $2, 'amlr', 'ai_generated', $3)`,
    [planId, planRow.version, JSON.stringify(validation.data)],
  );

  logger.info('AMLR mapping complete', { planId });
  return { mappings: validation.data, warnings: validation.warnings };
}

pipelineRouter.post('/:id/map-amlr', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;

  const mappingResult = await executeAMLRMapping(result.planRow);
  if (!mappingResult) {
    res.status(400).json({ error: 'Missing previous steps or AI failed.' });
    return;
  }
  res.json({ amlrMappings: mappingResult.mappings, warnings: mappingResult.warnings, nextStep: 'plan' });
});

// ===========================================================================
// Gate 2: Human AMLR Review
// ===========================================================================

pipelineRouter.patch('/:id/amlr', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow, ctx } = result;

  if (!planRow.amlr_mappings) {
    res.status(400).json({ error: 'AMLR not mapped yet.' });
    return;
  }

  const { mappings, reviewerNote } = req.body;
  const beforeState = planRow.amlr_mappings;
  const newVersion = planRow.version + 1;

  await db.query(
    `UPDATE training_plans SET amlr_mappings = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(mappings), newVersion, planRow.id],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, before_state, after_state, note)
     VALUES ($1, $2, 'amlr', 'human_override', $3, $4, $5, $6)`,
    [planRow.id, newVersion, ctx.userId, JSON.stringify(beforeState), JSON.stringify(mappings), reviewerNote ?? null],
  );

  res.json({ amlrMappings: mappings, version: newVersion, nextStep: 'plan' });
});

// ===========================================================================
// Regenerate AMLR after overrides
// ===========================================================================

pipelineRouter.post('/:id/regenerate-amlr', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;

  const mappingResult = await executeAMLRMapping(result.planRow);
  if (!mappingResult) {
    res.status(400).json({ error: 'Missing previous steps or AI failed.' });
    return;
  }
  res.json({ amlrMappings: mappingResult.mappings, warnings: mappingResult.warnings, regenerated: true, nextStep: 'plan' });
});

// ===========================================================================
// Step 5: Training Plan Generation (SSE streaming)
// ===========================================================================

pipelineRouter.post('/:id/generate-plan', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow } = result;

  if (!planRow.role_profile || !planRow.risk_matrix || !planRow.amlr_mappings) {
    res.status(400).json({ error: 'Previous steps incomplete.' });
    return;
  }

  const planId = planRow.id;
  const roleProfile = typeof planRow.role_profile === 'string' ? JSON.parse(planRow.role_profile) : planRow.role_profile;
  const riskMatrix = typeof planRow.risk_matrix === 'string' ? JSON.parse(planRow.risk_matrix) : planRow.risk_matrix;
  const mappings = typeof planRow.amlr_mappings === 'string' ? JSON.parse(planRow.amlr_mappings) : planRow.amlr_mappings;

  let articleExcerpts = '';
  try {
    const roleTitle = roleProfile.role_title || roleProfile.classified_as || 'this role';
    const searchResults = await searchChunks('AMLR', roleTitle, 8);
    articleExcerpts = searchResults.map((r, i) => `[Excerpt ${i + 1} — AMLR ${r.article_reference}]\n${r.content}`).join('\n\n');
  } catch (err) {
    logger.warn('RAG retrieval for plan gen failed', { error: String(err) });
  }

  const userPrompt = `${TRAINING_PLAN_USER}\n\nROLE PROFILE, RISK MATRIX, AMLR MAPPING:\n${JSON.stringify({ roleProfile, riskMatrix, amlrMappings: mappings }, null, 2)}\n\nREGULATORY EXCERPTS:\n${articleExcerpts}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  let fullText = '';
  let modelUsed = DEFAULT_MODEL;

  try {
    let stream: AsyncIterable<unknown>;
    try {
      stream = await openrouter.chat.completions.create({
        model: DEFAULT_MODEL, max_tokens: 5000, temperature: 0.3, stream: true,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
    } catch (err) {
      logger.warn(`Primary failed, fallback to ${FALLBACK_MODEL}`);
      modelUsed = FALLBACK_MODEL;
      stream = await openrouter.chat.completions.create({
        model: FALLBACK_MODEL, max_tokens: 5000, temperature: 0.3, stream: true,
        messages: [
          { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
    }

    for await (const chunk of stream as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>) {
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) { fullText += text; send({ type: 'token', token: text }); }
    }

    const validation = validateTrainingPlan(fullText);
    if (!validation.valid || !validation.data) {
      send({ type: 'error', message: 'Validation failed', warnings: validation.warnings });
      res.end(); return;
    }

    await db.query(
      `UPDATE training_plans SET training_plan = $1, current_step = 'plan', updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(validation.data), planId],
    );

    await db.query(
      `INSERT INTO plan_events (plan_id, version, step, action, after_state)
       VALUES ($1, $2, 'plan', 'ai_generated', $3)`,
      [planId, planRow.version, JSON.stringify(validation.data)],
    );

    logger.info('Training plan generated', { planId, model: modelUsed });
    send({ type: 'done', plan: validation.data, warnings: validation.warnings });
  } catch (err) {
    logger.error('Plan generation failed', { error: String(err) });
    send({ type: 'error', message: 'AI generation failed' });
  } finally {
    res.end();
  }
});

// ===========================================================================
// Gate 3: Plan edit + approval
// ===========================================================================

pipelineRouter.patch('/:id/plan', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow, ctx } = result;

  if (!planRow.training_plan) {
    res.status(400).json({ error: 'Plan not generated yet.' });
    return;
  }

  const { trainingPlan, reviewerNote } = req.body;
  const beforeState = planRow.training_plan;
  const newVersion = planRow.version + 1;

  await db.query(
    `UPDATE training_plans SET training_plan = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(trainingPlan), newVersion, planRow.id],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, before_state, after_state, note)
     VALUES ($1, $2, 'plan', 'human_override', $3, $4, $5, $6)`,
    [planRow.id, newVersion, ctx.userId, JSON.stringify(beforeState), JSON.stringify(trainingPlan), reviewerNote ?? null],
  );

  res.json({ trainingPlan, version: newVersion });
});

pipelineRouter.patch('/:id/approve', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow, ctx } = result;

  if (!planRow.training_plan || planRow.status !== 'draft') {
    res.status(400).json({ error: 'Plan not found, already approved, or not generated.' });
    return;
  }

  const { reviewer } = req.body;
  const newVersion = planRow.version + 1;
  const reviewerName = reviewer ?? ctx.userId;

  await db.query(
    `UPDATE training_plans SET status = 'approved', reviewer = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [reviewerName, newVersion, planRow.id],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, after_state)
     VALUES ($1, $2, 'plan', 'approved', $3, $4)`,
    [planRow.id, newVersion, reviewerName, JSON.stringify({ status: 'approved' })],
  );

  res.json({ status: 'approved', version: newVersion });
});

pipelineRouter.post('/:id/regenerate-plan', (req: Request, res: Response) => {
  res.status(307).json({ redirect: `/api/pipeline/${req.params.id}/generate-plan`, message: 'Regeneration triggered. Call generate-plan.' });
});

// ===========================================================================
// Step 7: LMS Assignment
// ===========================================================================

pipelineRouter.get('/:id/assignments', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;

  const { rows } = await db.query(
    `SELECT a.id, a.user_id, a.module_index, a.quarter, a.due_date, a.status, a.completed_at
     FROM plan_assignments a
     WHERE a.plan_id = $1
     ORDER BY a.quarter, a.module_index`,
    [req.params.id],
  );
  res.json(rows);
});

pipelineRouter.post('/:id/assign', async (req: Request, res: Response) => {
  const result = await getScopedPlan(req, res);
  if (!result) return;
  const { planRow } = result;

  if (!planRow.training_plan || planRow.status !== 'approved') {
    res.status(400).json({ error: 'Plan not approved or not generated.' });
    return;
  }

  const { userIds, dueDate } = req.body;
  const plan = typeof planRow.training_plan === 'string' ? JSON.parse(planRow.training_plan) : planRow.training_plan;
  const users: string[] = Array.isArray(userIds) ? userIds : [userIds];

  for (const userId of users) {
    for (const q of plan.quarters) {
      for (let mi = 0; mi < q.modules.length; mi++) {
        await db.query(
          `INSERT INTO plan_assignments (plan_id, user_id, module_index, quarter, due_date, status)
           VALUES ($1, $2, $3, $4, $5, 'not_started')
           ON CONFLICT (plan_id, user_id, module_index, quarter) DO NOTHING`,
          [planRow.id, userId, mi, q.quarter, dueDate ?? null],
        );
      }
    }
  }

  res.json({ ok: true, assigned: users.length });
});

export default pipelineRouter;
