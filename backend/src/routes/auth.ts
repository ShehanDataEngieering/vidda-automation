import { Router, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { z } from 'zod';
import { requireSignedIn } from '../middleware/requireAuth';
import { getUserContext } from '../utils/getUser';

export const authRouter = Router();

const SetCompanySchema = z.object({
  companyId: z.string().uuid(),
  role: z.enum(['admin', 'employee']),
  employeeRole: z.string().optional(),
});

/**
 * POST /api/auth/set-company
 * Called after company creation to attach companyId + role to a Clerk user's publicMetadata.
 * Admin calls this for themselves after onboarding; also used to set up employee accounts.
 */
authRouter.post('/set-company', requireSignedIn, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const parsed = SetCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { companyId, role, employeeRole } = parsed.data;

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        companyId,
        role,
        employeeRole: employeeRole ?? null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('set-company error:', err);
    res.status(500).json({ error: 'Failed to update user metadata' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user's context extracted from Clerk session claims.
 */
authRouter.get('/me', requireSignedIn, (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return; // getUserContext already sent 401/403
  res.json(user);
});
