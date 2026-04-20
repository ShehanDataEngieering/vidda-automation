/**
 * POST /api/generate
 *
 * Runs the full compliance training pipeline for a company and streams
 * progress to the client via Server-Sent Events (SSE).
 *
 * SSE event shape:
 *   { type: 'stage',        message: string }          — pipeline stage update
 *   { type: 'gap_found',    regulation, score, roles } — one per gap detected
 *   { type: 'module_start', regulation, role, moduleId }
 *   { type: 'chunk',        content, moduleId }         — streaming text delta
 *   { type: 'module_done',  moduleId, qualityScore }
 *   { type: 'done' }
 *   { type: 'error',        message }
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { analyzeGaps } from '../services/gapAnalysis';
import { searchChunks } from '../services/vectorSearch';
import { streamModule } from '../services/generation';
import { scoreModule } from '../services/qualityScore';
import type { SseEvent } from '../types';
import Anthropic from '@anthropic-ai/sdk';

export const generateRouter = Router();

// Single shared client — re-using the same instance avoids repeated auth overhead
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GenerateBodySchema = z.object({
  companyId: z.string().uuid(),
});

generateRouter.post('/', async (req: Request, res: Response) => {
  const parsed = GenerateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { companyId } = parsed.data;

  // Both DB lookups happen before SSE headers are sent, so errors here can
  // still return a normal JSON response rather than a broken SSE stream.
  let profileRows: { regulation: string; score: number }[];
  try {
    const companyResult = await db.query(
      `SELECT id FROM companies WHERE id = $1`,
      [companyId]
    );
    if (companyResult.rowCount === 0) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const profilesResult = await db.query<{ regulation: string; score: number }>(
      `SELECT regulation, score FROM risk_profiles WHERE company_id = $1`,
      [companyId]
    );
    profileRows = profilesResult.rows;
  } catch (err) {
    console.error('Generate pre-SSE db error:', err);
    res.status(500).json({ error: 'Database error' });
    return;
  }

  // SSE requires these headers before any data is written.
  // cors() middleware already sets Access-Control-Allow-Origin — no need to repeat it here.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event: SseEvent) =>
    res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    send({ type: 'stage', message: '🔍 Analysing compliance gaps...' });

    const gaps = analyzeGaps(profileRows);

    if (gaps.length === 0) {
      send({ type: 'stage', message: '✅ No gaps found — all scores above 70' });
      send({ type: 'done' });
      res.end();
      return;
    }

    for (const gap of gaps) {
      send({ type: 'gap_found', regulation: gap.regulation, score: gap.score, roles: gap.roles });
    }

    // Generate one module per gap×role combination sequentially — parallel generation
    // would saturate the Anthropic API rate limit for a small team's API key
    for (const gap of gaps) {
      for (const role of gap.roles) {
        send({ type: 'stage', message: `🔎 Searching ${gap.regulation} database for ${role}...` });

        const chunks = await searchChunks(db, gap.regulation, role);

        // Insert the module row before streaming begins so we have an ID to
        // attach subsequent chunk events to on the frontend
        const moduleInsert = await db.query<{ id: string }>(
          `INSERT INTO training_modules (company_id, regulation, role, status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [companyId, gap.regulation, role]
        );
        const moduleId = moduleInsert.rows[0]?.id;
        if (!moduleId) throw new Error('Failed to insert training module');

        send({ type: 'module_start', regulation: gap.regulation, role, moduleId });

        let fullContent = '';
        for await (const text of streamModule(anthropic, gap.regulation, role, chunks)) {
          fullContent += text;
          send({ type: 'chunk', content: text, moduleId });
        }

        const qualityScore = scoreModule(fullContent, gap.regulation);
        await db.query(
          `UPDATE training_modules SET content = $1, quality_score = $2, updated_at = NOW() WHERE id = $3`,
          [fullContent, qualityScore, moduleId]
        );

        send({ type: 'module_done', moduleId, qualityScore });
      }
    }

    send({ type: 'done' });
  } catch (err) {
    console.error('Generate pipeline error:', err);
    send({ type: 'error', message: 'Generation pipeline failed' });
  } finally {
    res.end();
  }
});
