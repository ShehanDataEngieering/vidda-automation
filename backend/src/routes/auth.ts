import { Router, Request, Response } from 'express';
import { requireSignedIn } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

// Company + role are only ever assigned server-side: POST /api/companies makes the
// creator admin of a new company, and Clerk invitations (POST /api/users/invite)
// carry companyId/role for invited users. There is deliberately no endpoint that
// lets a user pick their own companyId or role.

/**
 * GET /api/auth/me
 * Returns the current user's context extracted from Clerk session claims.
 */
authRouter.get('/me', requireSignedIn, asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserContext(req, res);
  if (!user) return; // getUserContext already sent 401/403
  res.json(user);
}));
