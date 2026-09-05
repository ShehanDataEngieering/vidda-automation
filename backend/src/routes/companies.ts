import { Router, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { z } from 'zod';
import { db } from '../db/client';
import { requireSignedIn } from '../middleware/auth';
import { logger } from '../utils/logger';

export const companiesRouter = Router();

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1).max(255),
  industry: z.string().trim().min(1).max(100),
  size: z.string().trim().max(50).optional(),
});

/**
 * POST /api/companies
 * Self-serve onboarding: the signed-in Clerk user has no companyId yet, so
 * getUserContext (which requires one) can't be used here — read the user
 * directly off req.resolvedUser instead. Creates the company row and attaches
 * companyId + admin role to the caller's Clerk metadata in one step, so the
 * client never sees a company created without an owner.
 */
companiesRouter.post('/', requireSignedIn, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.resolvedUser?.publicMetadata?.['companyId']) {
    res.status(409).json({ error: 'This account is already attached to a company.' });
    return;
  }

  const parsed = CreateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, industry, size } = parsed.data;

  try {
    const { rows } = await db.query<{ id: string }>(
      'INSERT INTO companies (name, industry, size) VALUES ($1, $2, $3) RETURNING id',
      [name, industry, size ?? null],
    );
    const companyId = rows[0]!.id;

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { companyId, role: 'admin', employeeRole: null },
    });

    logger.info('Company created', { companyId, userId });
    res.status(201).json({ companyId });
  } catch (err) {
    logger.error('Company creation failed', { error: String(err) });
    res.status(500).json({ error: 'Failed to create company' });
  }
});
