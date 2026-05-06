import { UserButton } from '@clerk/react';

type AdminScreen = 'onboarding' | 'generation' | 'review' | 'output' | 'documents';
type EmployeeScreen = 'chat' | 'training';
type Screen = AdminScreen | EmployeeScreen;

interface NavBarProps {
  role: 'admin' | 'employee';
  screen: Screen;
  onNavigate: (s: Screen) => void;
}

const adminNav: { id: AdminScreen; label: string; icon: string }[] = [
  { id: 'onboarding', label: 'Company', icon: '⬡' },
  { id: 'generation', label: 'Generate', icon: '⚡' },
  { id: 'review', label: 'Review', icon: '✓' },
  { id: 'documents', label: 'Documents', icon: '⬢' },
];

const employeeNav: { id: EmployeeScreen; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '◎' },
  { id: 'training', label: 'Training', icon: '▣' },
];

export default function NavBar({ role, screen, onNavigate }: NavBarProps) {
  const items = role === 'admin' ? adminNav : employeeNav;

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[#111827] border-r border-white/5 flex flex-col z-10">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">V</div>
          <span className="text-white font-semibold text-sm tracking-wide">Vidda</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 ml-10 capitalize">{role} portal</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Screen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-indigo-500/15 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1 h-4 rounded-full bg-indigo-400" />}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-6 py-5 border-t border-white/5 flex items-center gap-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
              userButtonPopoverCard: 'bg-[#1E293B] border border-white/10',
            },
          }}
        />
        <span className="text-xs text-slate-500 truncate">Account</span>
      </div>
    </aside>
  );
}
