import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { analyzeGaps } from '../services/gapAnalysis';
import { searchChunks } from '../services/rag/vectorSearch';
import { streamModule } from '../services/llm/generation';
import { scoreModule } from '../services/qualityScore';
import type { SseEvent } from '../types';

export const generateRouter = Router();

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

  // Pre-SSE DB lookups — errors here return JSON (not broken SSE)
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event: SseEvent) =>
    res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    send({ type: 'stage', message: '📥 Analysing risk profile...' });

    const gaps = analyzeGaps(profileRows);

    if (gaps.length === 0) {
      send({ type: 'stage', message: '✅ No compliance gaps found — all scores above 70' });
      send({ type: 'complete', totalModules: 0 });
      res.end();
      return;
    }

    send({ type: 'stage', message: `🔍 Identified ${gaps.length} compliance gap(s)` });

    for (const gap of gaps) {
      send({
        type: 'gap_found',
        regulation: gap.regulation,
        score: gap.score,
        severity: gap.severity,
        roles: gap.affectedRoles,
      });
    }

    let totalModules = 0;

    for (const gap of gaps) {
      for (const role of gap.affectedRoles) {
        send({ type: 'stage', message: `📚 Searching ${gap.regulation} database (hybrid BM25 + FTS)...` });

        const chunks = await searchChunks(gap.regulation, role);

        send({ type: 'stage', message: `⚖️ Reranking results for ${role}...` });

        const moduleInsert = await db.query<{ id: string }>(
          `INSERT INTO training_modules (company_id, regulation, role, status)
           VALUES ($1, $2, $3, 'pending') RETURNING id`,
          [companyId, gap.regulation, role]
        );
        const moduleId = moduleInsert.rows[0]?.id;
        if (!moduleId) throw new Error('Failed to insert training module');

        send({ type: 'module_start', regulation: gap.regulation, role, moduleId });
        send({ type: 'stage', message: `🤖 Generating: ${gap.regulation} — ${role}...` });

        let fullContent = '';
        for await (const text of streamModule(gap.regulation, role, chunks)) {
          fullContent += text;
          send({ type: 'chunk', content: text, moduleId });
        }

        const qualityResult = scoreModule(fullContent, gap.regulation, chunks);

        await db.query(
          `UPDATE training_modules
           SET content = $1, quality_score = $2, quality_breakdown = $3,
               citation_grounded = $4, updated_at = NOW()
           WHERE id = $5`,
          [
            fullContent,
            qualityResult.score,
            JSON.stringify(qualityResult.breakdown),
            qualityResult.citationGrounded,
            moduleId,
          ]
        );

        send({
          type: 'module_done',
          moduleId,
          qualityScore: qualityResult.score,
          citationGrounded: qualityResult.citationGrounded,
          warnings: qualityResult.warnings,
        });

        send({
          type: 'stage',
          message: `✅ Quality check: ${qualityResult.score}% | Citations grounded: ${qualityResult.citationGrounded ? '✅' : '⚠️'}`,
        });

        totalModules++;
      }
    }

    send({ type: 'stage', message: '👤 Awaiting human review...' });
    send({ type: 'complete', totalModules });
  } catch (err) {
    console.error('Generate pipeline error:', err);
    send({ type: 'error', message: 'Generation pipeline failed' });
  } finally {
    res.end();
  }
});
