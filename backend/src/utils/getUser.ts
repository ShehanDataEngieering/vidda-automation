import { getAuth } from '@clerk/express';
import type { Request, Response } from 'express';

export interface UserContext {
  userId: string;
  companyId: string;
  role: 'admin' | 'employee';
  employeeRole: string | null;
}

/**
 * Extracts user context from a Clerk-authenticated request.
 * Sends 401/403 and returns null if context is missing — caller must return after null check.
 */
export function getUserContext(req: Request, res: Response): UserContext | null {
  const { userId, sessionClaims } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const meta = (sessionClaims?.['publicMetadata'] as Record<string, unknown> | undefined) ?? {};
  const companyId = meta['companyId'] as string | undefined;
  const role = meta['role'] as 'admin' | 'employee' | undefined;
  const employeeRole = (meta['employeeRole'] as string | undefined) ?? null;

  if (!companyId || !role) {
    res.status(403).json({ error: 'User account not fully configured — contact your administrator' });
    return null;
  }

  return { userId, companyId, role, employeeRole };
}
