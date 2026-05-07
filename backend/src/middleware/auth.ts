import { clerkMiddleware, getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

// Mount once at app level: app.use(clerkMiddleware())
export { clerkMiddleware };

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
 * Requires a specific role stored in Clerk publicMetadata.
 * Must be used after requireSignedIn.
 */
export function requireRole(role: 'admin' | 'employee') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { userId, sessionClaims } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const userRole = (sessionClaims?.['publicMetadata'] as Record<string, unknown> | undefined)?.['role'];
    if (userRole !== role) {
      res.status(403).json({ error: `Access denied — requires role: ${role}` });
      return;
    }
    next();
  };
}
