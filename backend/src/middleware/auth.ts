import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

// Mount once at app level: app.use(clerkMiddleware())
export { clerkMiddleware };

declare global {
  namespace Express {
    interface Request {
      resolvedUser?: {
        userId: string;
        publicMetadata: Record<string, unknown>;
      };
    }
  }
}

/**
 * Resolves user metadata from Clerk session claims if available,
 * otherwise falls back to Clerk API. Stores result on req.resolvedUser.
 * This runs AFTER clerkMiddleware and BEFORE route handlers.
 */
export async function resolveAuthUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    next();
    return;
  }

  // JWT may or may not include publicMetadata depending on Clerk template config
  const claimsMeta = (sessionClaims?.['publicMetadata'] as Record<string, unknown> | undefined);
  if (claimsMeta && claimsMeta['role']) {
    req.resolvedUser = { userId, publicMetadata: claimsMeta };
    next();
    return;
  }

  // Fallback: hit Clerk API once per request
  try {
    const user = await clerkClient.users.getUser(userId);
    req.resolvedUser = {
      userId,
      publicMetadata: (user.publicMetadata ?? {}) as Record<string, unknown>,
    };
    next();
  } catch (err) {
    console.error('[auth] Clerk API fetch failed:', err);
    next();
  }
}

/**
 * Requires a signed-in Clerk session. Returns 401 if no valid token.
 */
export function requireSignedIn(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Requires a specific role from resolved user metadata.
 * Must be used after resolveAuthUser (and after requireSignedIn at router level).
 */
export function requireRole(role: 'admin' | 'employee') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const userRole = req.resolvedUser?.publicMetadata?.['role'];
    if (userRole !== role) {
      res.status(403).json({ error: `Access denied — requires role: ${role}` });
      return;
    }
    next();
  };
}
