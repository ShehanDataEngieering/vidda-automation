import { getAuth, clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';

export interface UserContext {
  userId: string;
  companyId: string;
  role: 'admin' | 'employee';
  employeeRole: string | null;
}

function safeGetAuth(req: Request) {
  try {
    return getAuth(req);
  } catch {
    return null;
  }
}

/**
 * Extracts user context from a Clerk-authenticated request.
 * Prefers resolved metadata from req.resolvedUser (populated by middleware),
 * then falls back to session claims if available.
 * Sends 401/403 and returns null if context is missing — caller must return after null check.
 */
export async function getUserContext(req: Request, res: Response): Promise<UserContext | null> {
  // Priority: resolvedUser populated by resolveAuthUser middleware (works in tests & prod)
  const resolvedUser = req.resolvedUser;

  // Fallback: getAuth from Clerk middleware
  const auth = safeGetAuth(req);
  const userId = resolvedUser?.userId ?? auth?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  // Primary: resolved metadata
  const resolvedMeta = resolvedUser?.publicMetadata;

  // Fallback: session claims (for real Clerk JWT with custom claims template)
  const claimsMeta = auth?.sessionClaims?.['publicMetadata'] as Record<string, unknown> | undefined;

  const meta = resolvedMeta ?? claimsMeta ?? {};

  const companyId = meta['companyId'] as string | undefined;
  const role = meta['role'] as 'admin' | 'employee' | undefined;
  const employeeRole = (meta['employeeRole'] as string | undefined) ?? null;

  if (!companyId || !role) {
    res.status(403).json({ error: 'User account not fully configured — contact your administrator' });
    return null;
  }

  return { userId, companyId, role, employeeRole };
}
