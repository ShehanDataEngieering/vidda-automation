import { useState, type ReactNode } from 'react';
import { SignIn, useUser, ClerkLoaded } from '@clerk/react';
import { Shield, ShieldOff } from 'lucide-react';
import { ThemeProvider } from '@/components/theme-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import NavBar from './components/NavBar';
import Onboarding from './screens/Onboarding';
import Generation from './screens/Generation';
import ReviewDashboard from './screens/ReviewDashboard';
import FinalOutput from './screens/FinalOutput';
import DocumentManager from './screens/DocumentManager';
import ComplianceChat from './screens/ComplianceChat';
import TrainingDashboard from './screens/TrainingDashboard';
import UserManagement from './screens/UserManagement';
import CoursePlayer from './screens/CoursePlayer';
import type { TrainingModuleWithProgress } from './types';

type AdminScreen = 'onboarding' | 'generation' | 'review' | 'output' | 'documents' | 'users';
type EmployeeScreen = 'chat' | 'training' | 'course';
type Screen = AdminScreen | EmployeeScreen;

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md p-6">
        <ShieldOff className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

function RoleGate({ role, allowed, children }: { role: 'admin' | 'employee'; allowed: 'admin' | 'employee'; children: ReactNode }) {
  if (role !== allowed) return <AccessDenied />;
  return <>{children}</>;
}

function AdminGate({ role, children }: { role: 'admin' | 'employee'; children: ReactNode }) {
  return <RoleGate role={role} allowed="admin">{children}</RoleGate>;
}

function EmployeeGate({ role, children }: { role: 'admin' | 'employee'; children: ReactNode }) {
  return <RoleGate role={role} allowed="employee">{children}</RoleGate>;
}

function AuthedApp() {
  const { user } = useUser();
  const clerkCompanyId = (user?.publicMetadata?.companyId as string | undefined) ?? '';
  const clerkRole = user?.publicMetadata?.role as 'admin' | 'employee' | undefined;
  // New users without any metadata are setting up — treat as admin for onboarding.
  // Users with a companyId but no role default to employee (least privilege).
  const role = clerkRole ?? (clerkCompanyId ? 'employee' : 'admin');

  const [screen, setScreen] = useState<Screen>(role === 'admin' ? 'onboarding' : 'chat');
  const [companyId, setCompanyId] = useState<string>(clerkCompanyId);
  const [activeCourseModule, setActiveCourseModule] = useState<TrainingModuleWithProgress | null>(null);

  return (
    <div className="flex min-h-screen bg-background">
      <NavBar role={role} screen={screen} onNavigate={setScreen} />
      <main className="ml-56 flex-1 min-h-screen">
        <AdminGate role={role}>
          {screen === 'onboarding' && (
            <Onboarding onCompanyCreated={(id) => { setCompanyId(id); setScreen('generation'); }} />
          )}
          {screen === 'generation' && companyId && (
            <Generation companyId={companyId} onComplete={() => setScreen('review')} />
          )}
          {screen === 'review' && companyId && (
            <ReviewDashboard companyId={companyId} onFinish={() => setScreen('output')} />
          )}
          {screen === 'output' && companyId && (
            <FinalOutput companyId={companyId} />
          )}
          {screen === 'documents' && <DocumentManager />}
          {screen === 'users' && <UserManagement />}
        </AdminGate>

        <EmployeeGate role={role}>
          {screen === 'chat' && <ComplianceChat />}
          {screen === 'training' && (
            <TrainingDashboard
              onStartCourse={(m) => {
                setActiveCourseModule(m);
                setScreen('course');
              }}
            />
          )}
          {screen === 'course' && activeCourseModule && (
            <CoursePlayer
              module={activeCourseModule}
              onBack={() => setScreen('training')}
              onComplete={() => {
                setActiveCourseModule(prev => prev ? { ...prev, completed_at: new Date().toISOString() } : null);
              }}
            />
          )}
        </EmployeeGate>
      </main>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Vidda Compliance</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}

function AppInner() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
  return isSignedIn ? <ErrorBoundary><AuthedApp /></ErrorBoundary> : <LoginPage />;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vidda-theme">
      <ClerkLoaded>
        <AppInner />
      </ClerkLoaded>
    </ThemeProvider>
  );
}
