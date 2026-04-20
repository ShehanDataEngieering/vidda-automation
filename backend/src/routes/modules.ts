import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { searchChunks } from '../services/vectorSearch';
import { streamModule } from '../services/generation';
import { scoreModule } from '../services/qualityScore';
import Anthropic from '@anthropic-ai/sdk';

export const modulesRouter = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

modulesRouter.get('/:companyId', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, regulation, role, content, quality_score, status, created_at, updated_at
       FROM training_modules WHERE company_id = $1 ORDER BY created_at ASC`,
      [req.params.companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/modules error:', err);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

const PatchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewer: z.string().min(1),
  reason: z.string().optional(),
});

modulesRouter.patch('/:moduleId', async (req: Request, res: Response) => {
  const parsed = PatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { moduleId } = req.params;
  const { status, reviewer, reason } = parsed.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE training_modules SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, moduleId]
    );
    await client.query(
      `INSERT INTO reviews (module_id, reviewer, status, reason) VALUES ($1, $2, $3, $4)`,
      [moduleId, reviewer, status, reason ?? null]
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

modulesRouter.post('/:moduleId/regenerate', async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const { reason } = req.body as { reason?: string };

  const modResult = await db.query<{ regulation: string; role: string }>(
    `SELECT regulation, role FROM training_modules WHERE id = $1`,
    [moduleId]
  );
  if (modResult.rowCount === 0) {
    res.status(404).json({ error: 'Module not found' });
    return;
  }

  const { regulation, role } = modResult.rows[0];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const chunks = await searchChunks(db, regulation, role);
    send({ type: 'module_start', regulation, role, moduleId });

    let fullContent = '';
    for await (const text of streamModule(anthropic, regulation, role, chunks, reason)) {
      fullContent += text;
      send({ type: 'chunk', content: text });
    }

    const qualityScore = scoreModule(fullContent, regulation);
    await db.query(
      `UPDATE training_modules SET content = $1, quality_score = $2, status = 'pending', updated_at = NOW() WHERE id = $3`,
      [fullContent, qualityScore, moduleId]
    );

    send({ type: 'module_done', moduleId, qualityScore });
    send({ type: 'done' });
  } catch (err) {
    console.error('Regenerate error:', err);
    send({ type: 'error', message: 'Regeneration failed' });
  } finally {
    res.end();
  }
});
