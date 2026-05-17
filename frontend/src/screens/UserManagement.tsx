import { useState, useEffect } from 'react';
import { Users, Mail, Trash2, Shield, UserCheck, Clock, ChevronDown, Send, Loader2, AlertCircle } from 'lucide-react';
import { useApi } from '../utils/api';
import type { CompanyUser, PendingInvitation } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const EMPLOYEE_ROLES = [
  'Front Office',
  'Back Office',
  'Risk Management',
  'Compliance',
  'IT / Technology',
  'HR',
  'Legal',
  'Finance',
  'Operations',
  'Executive',
];

function Avatar({ user }: { user: CompanyUser }) {
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() || user.email[0]?.toUpperCase() || '?';
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {user.imageUrl ? (
        <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}

export default function UserManagement() {
  const apiFetch = useApi();

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmployeeRole, setInviteEmployeeRole] = useState('Front Office');
  const [inviteRole, setInviteRole] = useState<'employee' | 'admin'>('employee');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Action in-progress tracking
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<Set<string>>(new Set());

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [usersRes, invRes] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/users/invitations'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json() as CompanyUser[]);
    if (invRes.ok) setInvitations(await invRes.json() as PendingInvitation[]);
    setLoading(false);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const res = await apiFetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), employeeRole: inviteEmployeeRole, role: inviteRole }),
    });

    if (res.ok) {
      const inv = await res.json() as PendingInvitation;
      setInvitations(prev => [inv, ...prev]);
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setInviteError(body.error ?? 'Failed to send invitation');
    }
    setInviting(false);
  }

  async function revokeInvitation(id: string) {
    setRevoking(prev => new Set(prev).add(id));
    const res = await apiFetch(`/api/users/invitations/${id}`, { method: 'DELETE' });
    if (res.ok) setInvitations(prev => prev.filter(i => i.id !== id));
    else setError('Failed to revoke invitation');
    setRevoking(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  async function removeUser(userId: string) {
    setRemoving(prev => new Set(prev).add(userId));
    const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== userId));
    else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? 'Failed to remove user');
    }
    setRemoving(prev => { const s = new Set(prev); s.delete(userId); return s; });
  }

  async function updateRole(userId: string, role: 'admin' | 'employee', employeeRole?: string) {
    const res = await apiFetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, employeeRole }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role, employeeRole: employeeRole ?? u.employeeRole } : u));
    } else {
      setError('Failed to update role');
    }
  }

  const adminCount = users.filter(u => u.role === 'admin').length;
  const employeeCount = users.filter(u => u.role === 'employee').length;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
          <Users className="h-5 w-5 text-white dark:text-slate-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground">Manage access to your compliance platform.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Active users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employeeCount}</p>
              <p className="text-xs text-muted-foreground">Employees</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite form */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Invite a team member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => void sendInvite(e)} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
              className="flex-1 text-sm"
            />

            {/* Employee role selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-40 justify-between text-sm">
                  {inviteEmployeeRole}
                  <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {EMPLOYEE_ROLES.map(r => (
                  <DropdownMenuItem key={r} onClick={() => setInviteEmployeeRole(r)}>
                    {r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Role toggle */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setInviteRole('employee')}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', inviteRole === 'employee' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                Employee
              </button>
              <button
                type="button"
                onClick={() => setInviteRole('admin')}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors border-l', inviteRole === 'admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                Admin
              </button>
            </div>

            <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Send invite
            </Button>
          </form>

          {inviteSuccess && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />{inviteSuccess}
            </p>
          )}
          {inviteError && (
            <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />{inviteError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active users */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active users <span className="font-normal text-muted-foreground">({users.length})</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <div className="divide-y divide-border">
              {users.map(user => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={user} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.email}
                      </p>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                        {user.role === 'admin' ? <Shield className="h-2.5 w-2.5 mr-1" /> : null}
                        {user.role}
                      </Badge>
                      {user.employeeRole && (
                        <Badge variant="outline" className="text-[10px] font-normal">{user.employeeRole}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Role change dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                          Change role <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => void updateRole(user.id, 'admin')}>
                          <Shield className="h-3.5 w-3.5 mr-2" />Make admin
                        </DropdownMenuItem>
                        {EMPLOYEE_ROLES.map(er => (
                          <DropdownMenuItem key={er} onClick={() => void updateRole(user.id, 'employee', er)}>
                            <UserCheck className="h-3.5 w-3.5 mr-2" />Employee · {er}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Remove button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => void removeUser(user.id)}
                      disabled={removing.has(user.id)}
                      title="Remove user"
                    >
                      {removing.has(user.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pending invitations <span className="font-normal text-muted-foreground">({invitations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={inv.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">{inv.role}</Badge>
                      {inv.employeeRole && <Badge variant="outline" className="text-[10px] font-normal">{inv.employeeRole}</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        Sent {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => void revokeInvitation(inv.id)}
                    disabled={revoking.has(inv.id)}
                  >
                    {revoking.has(inv.id) ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
