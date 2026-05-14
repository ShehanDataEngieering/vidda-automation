import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { searchChunks } from '../services/rag/vectorSearch';
import { streamModule } from '../services/llm/generation';
import { scoreModule } from '../services/qualityScore';
import type { SseEvent } from '../types';

export const modulesRouter = Router();

const CompanyIdSchema = z.string().uuid();

modulesRouter.get('/:companyId', async (req: Request, res: Response) => {
  const parsed = CompanyIdSchema.safeParse(req.params['companyId']);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid company ID — must be a UUID' });
    return;
  }
  try {
    const result = await db.query(
      `SELECT id, regulation, role, content, quality_score, quality_breakdown,
              citation_grounded, status, version, rationale, risk_dimensions, created_at, updated_at
       FROM training_modules WHERE company_id = $1 ORDER BY created_at ASC`,
      [parsed.data]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/modules error:', err);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

const PatchSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  reviewer: z.string().optional().default('Compliance Officer'),
  comment: z.string().optional(),
});

modulesRouter.patch('/:moduleId', async (req: Request, res: Response) => {
  const moduleIdParsed = CompanyIdSchema.safeParse(req.params['moduleId']);
  if (!moduleIdParsed.success) {
    res.status(400).json({ error: 'Invalid module ID — must be a UUID' });
    return;
  }
  const parsed = PatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const moduleId = moduleIdParsed.data;
  const { action, reviewer, comment } = parsed.data;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Store previous content for audit trail
    const mod = await client.query<{ content: string }>(
      `SELECT content FROM training_modules WHERE id = $1`,
      [moduleId]
    );
    const previousContent = mod.rows[0]?.content ?? null;

    await client.query(
      `UPDATE training_modules SET status = $1, updated_at = NOW() WHERE id = $2`,
      [action, moduleId]
    );
    await client.query(
      `INSERT INTO reviews (module_id, action, reviewer, comment, previous_content)
       VALUES ($1, $2, $3, $4, $5)`,
      [moduleId, action, reviewer, comment ?? null, previousContent]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/modules error:', err);
    res.status(500).json({ error: 'Failed to update module' });
  } finally {
    client.release();
  }
});

const RegenerateSchema = z.object({
  reason: z.string().optional(),
});

modulesRouter.post('/:moduleId/regenerate', async (req: Request, res: Response) => {
  const moduleIdParsed = CompanyIdSchema.safeParse(req.params['moduleId']);
  if (!moduleIdParsed.success) {
    res.status(400).json({ error: 'Invalid module ID — must be a UUID' });
    return;
  }
  const parsed = RegenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const moduleId = moduleIdParsed.data;
  const { reason } = parsed.data;

  let regulation: string;
  let role: string;
  let previousContent: string | null = null;

  try {
    const modResult = await db.query<{ regulation: string; role: string; content: string | null }>(
      `SELECT regulation, role, content FROM training_modules WHERE id = $1`,
      [moduleId]
    );
    const mod = modResult.rows[0];
    if (!mod) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    regulation = mod.regulation;
    role = mod.role;
    previousContent = mod.content;
  } catch (err) {
    console.error('Regenerate pre-SSE db error:', err);
    res.status(500).json({ error: 'Database error' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event: SseEvent) =>
    res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    send({ type: 'stage', message: `📚 Searching ${regulation} regulatory database...` });
    const chunks = await searchChunks(regulation, role);

    send({ type: 'module_start', regulation, role, moduleId });

    let fullContent = '';
    for await (const text of streamModule(regulation, role, chunks, reason)) {
      fullContent += text;
      send({ type: 'chunk', content: text, moduleId });
    }

    const qualityResult = scoreModule(fullContent, regulation, chunks);

    // Store previous content in audit trail + bump version
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE training_modules
         SET content = $1, quality_score = $2, quality_breakdown = $3,
             citation_grounded = $4, status = 'pending',
             version = version + 1, updated_at = NOW()
         WHERE id = $5`,
        [
          fullContent,
          qualityResult.score,
          JSON.stringify(qualityResult.breakdown),
          qualityResult.citationGrounded,
          moduleId,
        ]
      );
      await client.query(
        `INSERT INTO reviews (module_id, action, reviewer, comment, previous_content)
         VALUES ($1, 'regenerated', 'System', $2, $3)`,
        [moduleId, reason ?? null, previousContent]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    send({
      type: 'module_done',
      moduleId,
      qualityScore: qualityResult.score,
      citationGrounded: qualityResult.citationGrounded,
      warnings: qualityResult.warnings,
    });
    send({ type: 'complete', totalModules: 1 });
  } catch (err) {
    console.error('Regenerate error:', err);
    send({ type: 'error', message: 'Regeneration failed' });
  } finally {
    res.end();
  }
});

// GET audit trail for a module
modulesRouter.get('/:moduleId/reviews', async (req: Request, res: Response) => {
  const moduleIdParsed = CompanyIdSchema.safeParse(req.params['moduleId']);
  if (!moduleIdParsed.success) {
    res.status(400).json({ error: 'Invalid module ID — must be a UUID' });
    return;
  }
  const moduleId = moduleIdParsed.data;
  try {
    const result = await db.query(
      `SELECT id, action, reviewer, comment, created_at
       FROM reviews WHERE module_id = $1 ORDER BY created_at ASC`,
      [moduleId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});
