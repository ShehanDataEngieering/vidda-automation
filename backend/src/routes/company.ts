import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';

export const companyRouter = Router();

const CompanySchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  regulations: z.array(z.string()).min(1),
  scores: z.record(z.string(), z.number().min(0).max(100)),
});

companyRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, industry, regulations, scores } = parsed.data;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const companyResult = await client.query<{ id: string }>(
      `INSERT INTO companies (name, industry, regulations)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, industry, regulations]
    );
    const companyId = companyResult.rows[0].id;

    for (const regulation of regulations) {
      const score = scores[regulation] ?? 0;
      await client.query(
        `INSERT INTO risk_profiles (company_id, regulation, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id, regulation)
         DO UPDATE SET score = EXCLUDED.score`,
        [companyId, regulation, score]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ companyId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/company error:', err);
    res.status(500).json({ error: 'Failed to save company' });
  } finally {
    client.release();
  }
});
