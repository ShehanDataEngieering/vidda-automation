import { Router, Request, Response } from 'express';
import { clerkClient } from '@clerk/express';
import { z } from 'zod';
import { requireSignedIn, requireRole } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { logger } from '../utils/logger';

export const usersRouter = Router();

// All user-management routes are admin-only
usersRouter.use(requireSignedIn, requireRole('admin'));

/** GET /api/users — list all users in this company */
usersRouter.get('/', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  try {
    // Fetch up to 500 users; filter by companyId in publicMetadata
    const { data: allUsers } = await clerkClient.users.getUserList({ limit: 500 });

    const companyUsers = allUsers
      .filter(u => (u.publicMetadata as Record<string, unknown>)?.companyId === ctx.companyId)
      .map(u => {
        const meta = u.publicMetadata as Record<string, unknown>;
        return {
          id: u.id,
          email: u.emailAddresses[0]?.emailAddress ?? '',
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          imageUrl: u.imageUrl,
          role: (meta.role as string) ?? 'employee',
          employeeRole: (meta.employeeRole as string) ?? null,
          lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
          createdAt: new Date(u.createdAt).toISOString(),
        };
      })
      // Sort: admins first, then alphabetically
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName);
      });

    res.json(companyUsers);
  } catch (err) {
    logger.error('GET /api/users error', { error: String(err) });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

const InviteSchema = z.object({
  email: z.string().email(),
  employeeRole: z.string().min(1),
  role: z.enum(['admin', 'employee']).default('employee'),
});

/** POST /api/users/invite — send a Clerk invitation with pre-set metadata */
usersRouter.post('/invite', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, employeeRole, role } = parsed.data;

  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        companyId: ctx.companyId,
        role,
        employeeRole: role === 'employee' ? employeeRole : null,
      },
      // Redirect to the app after accepting the invitation
      redirectUrl: process.env.VITE_APP_URL ?? 'http://localhost:5173',
      ignoreExisting: false,
    });

    logger.info('Invitation sent', { email, role, employeeRole, companyId: ctx.companyId });
    res.status(201).json({
      id: invitation.id,
      email: invitation.emailAddress,
      status: invitation.status,
      createdAt: invitation.createdAt,
    });
  } catch (err: unknown) {
    const msg = String(err);
    logger.error('POST /api/users/invite error', { error: msg });

    // Clerk throws a specific error when an invitation already exists
    if (msg.includes('already been invited') || msg.includes('duplicate')) {
      res.status(409).json({ error: 'An invitation has already been sent to this email address.' });
      return;
    }
    if (msg.includes('already exists') || msg.includes('user exists')) {
      res.status(409).json({ error: 'A user with this email already exists. Use the update role action instead.' });
      return;
    }
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

/** GET /api/users/invitations — pending invitations for this company */
usersRouter.get('/invitations', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  try {
    const { data: allInvitations } = await clerkClient.invitations.getInvitationList({
      status: 'pending',
      limit: 500,
    });

    const companyInvitations = allInvitations
      .filter(inv => {
        const meta = inv.publicMetadata as Record<string, unknown>;
        return meta?.companyId === ctx.companyId;
      })
      .map(inv => {
        const meta = inv.publicMetadata as Record<string, unknown>;
        return {
          id: inv.id,
          email: inv.emailAddress,
          role: (meta.role as string) ?? 'employee',
          employeeRole: (meta.employeeRole as string) ?? null,
          createdAt: inv.createdAt,
        };
      });

    res.json(companyInvitations);
  } catch (err) {
    logger.error('GET /api/users/invitations error', { error: String(err) });
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

/** DELETE /api/users/invitations/:id — revoke a pending invitation */
usersRouter.delete('/invitations/:id', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { id } = req.params;

  try {
    await clerkClient.invitations.revokeInvitation(id);
    logger.info('Invitation revoked', { invitationId: id, companyId: ctx.companyId });
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/users/invitations/:id error', { error: String(err) });
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

/** PATCH /api/users/:userId/role — update a user's role / employeeRole */
const UpdateRoleSchema = z.object({
  role: z.enum(['admin', 'employee']),
  employeeRole: z.string().optional(),
});

usersRouter.patch('/:userId/role', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { userId } = req.params;

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Verify the target user belongs to this company
  try {
    const targetUser = await clerkClient.users.getUser(userId);
    const targetMeta = targetUser.publicMetadata as Record<string, unknown>;
    if (targetMeta?.companyId !== ctx.companyId) {
      res.status(403).json({ error: 'User does not belong to your company' });
      return;
    }

    const { role, employeeRole } = parsed.data;
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...targetMeta,
        role,
        employeeRole: role === 'employee' ? (employeeRole ?? targetMeta.employeeRole ?? null) : null,
      },
    });

    logger.info('User role updated', { userId, role, employeeRole, companyId: ctx.companyId });
    res.json({ ok: true });
  } catch (err) {
    logger.error('PATCH /api/users/:userId/role error', { error: String(err) });
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/** DELETE /api/users/:userId — remove user from company (clears metadata) */
usersRouter.delete('/:userId', async (req: Request, res: Response) => {
  const ctx = await getUserContext(req, res);
  if (!ctx) return;

  const { userId } = req.params;

  // Prevent self-removal
  const { userId: adminId } = (req as unknown as { auth: { userId: string } }).auth ?? {};
  if (userId === adminId || userId === ctx.userId) {
    res.status(400).json({ error: 'You cannot remove yourself from the company.' });
    return;
  }

  try {
    const targetUser = await clerkClient.users.getUser(userId);
    const targetMeta = targetUser.publicMetadata as Record<string, unknown>;

    if (targetMeta?.companyId !== ctx.companyId) {
      res.status(403).json({ error: 'User does not belong to your company' });
      return;
    }

    // Clear company metadata — user's Clerk account stays but loses access
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { companyId: null, role: null, employeeRole: null },
    });

    logger.info('User removed from company', { userId, companyId: ctx.companyId });
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/users/:userId error', { error: String(err) });
    res.status(500).json({ error: 'Failed to remove user' });
  }
});
