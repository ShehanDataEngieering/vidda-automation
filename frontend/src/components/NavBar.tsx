import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import {
  Target, BookOpen, ChevronRight, Users, Menu, X, type LucideIcon
} from 'lucide-react';
import { LogoTile } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

// Admin navigation — pipeline + users only
const adminNav: NavItem[] = [
  { id: 'pipeline',   label: 'Pipeline',         icon: Target,      path: '/pipeline' },
  { id: 'users',      label: 'Team',             icon: Users,       path: '/users' },
];

// Employee navigation — LMS training view
const employeeNav: NavItem[] = [
  { id: 'training',   label: 'My Training',      icon: BookOpen,      path: '/lms/my-training' },
];

export default function NavBar({ role }: { role: 'admin' | 'employee' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const items = role === 'admin' ? adminNav : employeeNav;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar — hidden at lg and above, where the sidebar is always visible */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation menu" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <LogoTile size={24} />
          <p className="text-sm font-semibold text-sidebar-foreground">Vidda</p>
        </div>
      </div>

      {/* Backdrop, mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <LogoTile size={28} />
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">Vidda</p>
              <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role} portal</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            className="h-7 w-7 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            {role === 'admin' ? 'Administration' : 'Employee'}
          </p>
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  className={cn(
                    'group w-full flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-primary')} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-sidebar-foreground/40" />}
                </button>
              );
            })}
          </div>
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <UserButton />
            <span className="text-xs text-sidebar-foreground/50 capitalize">{role}</span>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
