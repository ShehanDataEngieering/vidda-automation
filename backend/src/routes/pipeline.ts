import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { openrouter, DEFAULT_MODEL, FALLBACK_MODEL } from '../services/llm/openrouter';
import { PIPELINE_SYSTEM_PROMPT, ROLE_ANALYSIS_USER, RISK_ASSESSMENT_USER, AMLR_MAPPING_USER } from '../services/llm/pipelinePrompt';
import { validateRoleProfile, validateRiskMatrix, validateAMLRMappings } from '../services/llm/pipelineValidator';
import { searchChunks } from '../services/rag/vectorSearch';
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

// ===========================================================================
// Helper: common AI call pattern (primary → fallback → validate → retry)
// Used by assess-risk, map-amlr, and generate-plan endpoints
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
// AI scores 5 risk dimensions (Low/Med/High/Critical) with justifications
// ===========================================================================

pipelineRouter.post('/:id/assess-risk', async (req: Request, res: Response) => {
  const { rows: plans } = await db.query(
    `SELECT id, version, role_profile FROM training_plans WHERE id = $1`,
    [req.params.id],
  );
  if (!plans[0] || !plans[0].role_profile) {
    res.status(400).json({ error: 'Plan not found or role not analysed yet. Run analyze-role first.' });
    return;
  }

  const planId = req.params.id;
  const roleJson = JSON.stringify(plans[0].role_profile);
  const userPrompt = `${RISK_ASSESSMENT_USER}\n\nROLE PROFILE:\n${roleJson}\n\nRISK MATRIX:\n`;

  try {
    // Phase 1: Primary + fallback
    let rawOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT, userPrompt, 800, 0.1);

    // Phase 2: Validate + retry on parse failure
    let validation = validateRiskMatrix(rawOutput);
    if (!validation.valid) {
      logger.warn('Risk matrix first attempt invalid, retrying');
      const retryPrompt = PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON array. No markdown, no other text.';
      const retryOutput = await callAIWithRetry(retryPrompt, userPrompt, 800, 0.0);
      validation = validateRiskMatrix(retryOutput);
    }

    if (!validation.valid || !validation.data) {
      res.status(500).json({ error: 'Risk assessment failed', warnings: validation.warnings });
      return;
    }

    // Save to DB
    await db.query(
      `UPDATE training_plans SET risk_matrix = $1, current_step = 'risk', updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(validation.data), planId],
    );

    // Audit event
    await db.query(
      `INSERT INTO plan_events (plan_id, version, step, action, after_state)
       VALUES ($1, $2, 'risk', 'ai_generated', $3)`,
      [planId, plans[0].version, JSON.stringify(validation.data)],
    );

    logger.info('Risk assessment complete', { planId, scores: validation.data.map(d => `${d.dimension}:${d.score}`) });

    res.json({ riskMatrix: validation.data, warnings: validation.warnings, nextStep: 'amlr' });
  } catch (err) {
    logger.error('Risk assessment failed', { error: String(err) });
    res.status(500).json({ error: 'AI risk assessment failed' });
  }
});

// ===========================================================================
// Gate 1: Human Risk Review — override any risk score
// Brief Section 5: Compliance officer reviews and may override any risk score
// ===========================================================================

pipelineRouter.patch('/:id/risk', async (req: Request, res: Response) => {
  const { overrides, reviewerNote } = req.body;
  // overrides: Record<string, { score: string; justification: string }>

  const { rows: plans } = await db.query(
    `SELECT id, version, risk_matrix FROM training_plans WHERE id = $1`,
    [req.params.id],
  );
  if (!plans[0] || !plans[0].risk_matrix) {
    res.status(400).json({ error: 'Plan not found or risk not assessed yet.' });
    return;
  }

  const planId = req.params.id;
  const beforeState = plans[0].risk_matrix;
  let riskMatrix = typeof beforeState === 'string' ? JSON.parse(beforeState) : beforeState;

  // Apply overrides
  if (overrides && typeof overrides === 'object') {
    riskMatrix = riskMatrix.map((dim: { dimension: string; justification?: string; score?: string }) => {
      const override = overrides[dim.dimension];
      if (override) {
        return { ...dim, score: override.score, justification: override.justification || (dim as { justification: string }).justification };
      }
      return dim;
    });
  }

  const newVersion = plans[0].version + 1;

  await db.query(
    `UPDATE training_plans SET risk_matrix = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(riskMatrix), newVersion, planId],
  );

  // Audit event
  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, before_state, after_state, note)
     VALUES ($1, $2, 'risk', 'human_override', $3, $4, $5, $6)`,
    [planId, newVersion, 'Compliance Officer', JSON.stringify(beforeState), JSON.stringify(riskMatrix), reviewerNote ?? null],
  );

  logger.info('Risk scores overridden by human', { planId, version: newVersion });

  res.json({ riskMatrix, version: newVersion, nextStep: 'amlr' });
});

// ===========================================================================
// Step 4: AMLR Article Mapping (with RAG retrieval)
// RAG retrieves real AMLR Articles 9-15 → AI maps which apply to this role
// ===========================================================================

async function executeAMLRMapping(planId: string): Promise<{ mappings: unknown[]; warnings: string[] } | null> {
  const { rows: plans } = await db.query(
    `SELECT id, version, role_profile, risk_matrix FROM training_plans WHERE id = $1`,
    [planId],
  );
  if (!plans[0] || !plans[0].role_profile || !plans[0].risk_matrix) {
    return null;
  }

  const roleProfile = typeof plans[0].role_profile === 'string'
    ? JSON.parse(plans[0].role_profile)
    : plans[0].role_profile;

  const roleTitle = roleProfile.role_title || roleProfile.classified_as || 'this role';

  // RAG retrieval: search regulatory_chunks for AMLR articles relevant to this role
  let articleExcerpts = '';
  try {
    const searchResults = await searchChunks('AMLR', roleTitle, 8);
    articleExcerpts = searchResults
      .map((r, i) => `[Excerpt ${i + 1} — AMLR ${r.article_reference}]\n${r.content}`)
      .join('\n\n');
    logger.debug('RAG retrieved AMLR chunks', { planId, count: searchResults.length });
  } catch (err) {
    logger.warn('RAG retrieval failed, proceeding without article excerpts', { error: String(err) });
  }

  const userPrompt = `${AMLR_MAPPING_USER}\n\nROLE PROFILE AND RISK MATRIX:\n${JSON.stringify(roleProfile, null, 2)}\n${JSON.stringify(plans[0].risk_matrix, null, 2)}\n\nREGULATORY EXCERPTS (AMLR 2024/1624):\n${articleExcerpts}`;

  // Phase 1: AI call with fallback
  let rawOutput = await callAIWithRetry(PIPELINE_SYSTEM_PROMPT, userPrompt, 1000, 0.1);

  // Phase 2: Validate + retry
  let validation = validateAMLRMappings(rawOutput);
  if (!validation.valid) {
    logger.warn('AMLR mapping first attempt invalid, retrying');
    const retryPrompt = PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON array. Only use AMLR Articles 9-15. No markdown.';
    const retryOutput = await callAIWithRetry(retryPrompt, userPrompt, 1000, 0.0);
    validation = validateAMLRMappings(retryOutput);
  }

  if (!validation.valid || !validation.data) {
    return null;
  }

  // Save to DB
  await db.query(
    `UPDATE training_plans SET amlr_mappings = $1, current_step = 'amlr', updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(validation.data), planId],
  );

  // Audit event
  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, after_state)
     VALUES ($1, $2, 'amlr', 'ai_generated', $3)`,
    [planId, plans[0].version, JSON.stringify(validation.data)],
  );

  logger.info('AMLR mapping complete', { planId, articles: validation.data.map((m: { article: string }) => m.article) });

  return { mappings: validation.data, warnings: validation.warnings };
}

pipelineRouter.post('/:id/map-amlr', async (req: Request, res: Response) => {
  try {
    const result = await executeAMLRMapping(req.params.id);
    if (!result) {
      res.status(400).json({ error: 'Plan not found or risk not assessed yet.' });
      return;
    }
    res.json({ amlrMappings: result.mappings, warnings: result.warnings, nextStep: 'plan' });
  } catch (err) {
    logger.error('AMLR mapping failed', { error: String(err) });
    res.status(500).json({ error: 'AI AMLR mapping failed' });
  }
});

// ===========================================================================
// Gate 2: Human AMLR Review — add/remove article mappings
// Brief Section 5: Legal/compliance team confirms article mapping
// ===========================================================================

pipelineRouter.patch('/:id/amlr', async (req: Request, res: Response) => {
  const { mappings, reviewerNote } = req.body;

  const { rows: plans } = await db.query(
    `SELECT id, version, amlr_mappings FROM training_plans WHERE id = $1`,
    [req.params.id],
  );
  if (!plans[0] || !plans[0].amlr_mappings) {
    res.status(400).json({ error: 'Plan not found or AMLR not mapped yet.' });
    return;
  }

  const planId = req.params.id;
  const beforeState = plans[0].amlr_mappings;
  const newVersion = plans[0].version + 1;

  await db.query(
    `UPDATE training_plans SET amlr_mappings = $1, version = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(mappings), newVersion, planId],
  );

  await db.query(
    `INSERT INTO plan_events (plan_id, version, step, action, reviewer, before_state, after_state, note)
     VALUES ($1, $2, 'amlr', 'human_override', $3, $4, $5, $6)`,
    [planId, newVersion, 'Compliance Officer', JSON.stringify(beforeState), JSON.stringify(mappings), reviewerNote ?? null],
  );

  logger.info('AMLR mappings overridden by human', { planId, version: newVersion });

  res.json({ amlrMappings: mappings, version: newVersion, nextStep: 'plan' });
});

// ===========================================================================
// Regeneration: after risk overrides, re-run AMLR mapping (Step 4)
// ===========================================================================

pipelineRouter.post('/:id/regenerate-amlr', async (req: Request, res: Response) => {
  try {
    const result = await executeAMLRMapping(req.params.id);
    if (!result) {
      res.status(400).json({ error: 'Plan not found or missing previous steps.' });
      return;
    }
    res.json({ amlrMappings: result.mappings, warnings: result.warnings, regenerated: true, nextStep: 'plan' });
  } catch (err) {
    logger.error('AMLR regeneration failed', { error: String(err) });
    res.status(500).json({ error: 'AI regeneration failed' });
  }
});

export default pipelineRouter;
