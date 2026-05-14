import { UserButton } from '@clerk/react';
import {
  Building2, FileText, Shield, CheckSquare, Upload,
  MessageSquare, BookOpen, ChevronRight, Users, type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';

type AdminScreen = 'onboarding' | 'generation' | 'review' | 'output' | 'documents' | 'users';
type EmployeeScreen = 'chat' | 'training' | 'course';
type Screen = AdminScreen | EmployeeScreen;

interface NavBarProps {
  role: 'admin' | 'employee';
  screen: Screen;
  onNavigate: (s: Screen) => void;
}

const adminNav: { id: AdminScreen; label: string; icon: LucideIcon }[] = [
  { id: 'onboarding', label: 'Company Setup', icon: Building2 },
  { id: 'generation', label: 'Generate Modules', icon: FileText },
  { id: 'review', label: 'Review', icon: CheckSquare },
  { id: 'output', label: 'Final Output', icon: Shield },
  { id: 'documents', label: 'Documents', icon: Upload },
  { id: 'users', label: 'Team', icon: Users },
];

const employeeNav: { id: EmployeeScreen; label: string; icon: LucideIcon }[] = [
  { id: 'chat', label: 'Compliance Chat', icon: MessageSquare },
  { id: 'training', label: 'My Training', icon: BookOpen },
];

export default function NavBar({ role, screen, onNavigate }: NavBarProps) {
  const items = role === 'admin' ? adminNav : employeeNav;

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground">Vidda</p>
          <p className="text-[10px] text-sidebar-foreground/50 capitalize">{role} portal</p>
        </div>
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
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Screen)}
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
  );
}
