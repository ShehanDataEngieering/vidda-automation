import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client';

export const companyRouter = Router();

// regulations is a map of regulation -> score, e.g. { AML: 40, KYC: 55, GDPR: 85 }
const CompanySchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  size: z.string().optional(),
  regulations: z.record(z.string(), z.number().min(0).max(100)),
});

companyRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, industry, size, regulations } = parsed.data;
  const regulationKeys = Object.keys(regulations);

  if (regulationKeys.length === 0) {
    res.status(400).json({ error: 'At least one regulation is required' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const companyResult = await client.query<{ id: string }>(
      `INSERT INTO companies (name, industry, size) VALUES ($1, $2, $3) RETURNING id`,
      [name, industry, size ?? null]
    );
    const companyId = companyResult.rows[0]?.id;
    if (!companyId) throw new Error('Insert returned no company id');

    for (const regulation of regulationKeys) {
      const score = regulations[regulation] ?? 0;
      await client.query(
        `INSERT INTO risk_profiles (company_id, regulation, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id, regulation) DO UPDATE SET score = EXCLUDED.score`,
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
