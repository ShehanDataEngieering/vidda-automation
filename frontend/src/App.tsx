import { useState } from 'react';
import { SignIn, useUser, ClerkLoaded } from '@clerk/react';
import { Shield } from 'lucide-react';
import { ThemeProvider } from '@/components/theme-provider';
import NavBar from './components/NavBar';
import Onboarding from './screens/Onboarding';
import Generation from './screens/Generation';
import ReviewDashboard from './screens/ReviewDashboard';
import FinalOutput from './screens/FinalOutput';
import DocumentManager from './screens/DocumentManager';
import ComplianceChat from './screens/ComplianceChat';
import TrainingDashboard from './screens/TrainingDashboard';
import UserManagement from './screens/UserManagement';

type AdminScreen = 'onboarding' | 'generation' | 'review' | 'output' | 'documents' | 'users';
type EmployeeScreen = 'chat' | 'training';
type Screen = AdminScreen | EmployeeScreen;

function AuthedApp() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as 'admin' | 'employee' | undefined) ?? 'admin';

  const [screen, setScreen] = useState<Screen>(role === 'admin' ? 'onboarding' : 'chat');
  const [companyId, setCompanyId] = useState<string>(
    (user?.publicMetadata?.companyId as string | undefined) ?? '',
  );

  return (
    <div className="flex min-h-screen bg-background">
      <NavBar role={role} screen={screen} onNavigate={setScreen} />
      <main className="ml-56 flex-1 min-h-screen">
        {role === 'admin' && screen === 'onboarding' && (
          <Onboarding onCompanyCreated={(id) => { setCompanyId(id); setScreen('generation'); }} />
        )}
        {role === 'admin' && screen === 'generation' && companyId && (
          <Generation companyId={companyId} onComplete={() => setScreen('review')} />
        )}
        {role === 'admin' && screen === 'review' && companyId && (
          <ReviewDashboard companyId={companyId} onFinish={() => setScreen('output')} />
        )}
        {role === 'admin' && screen === 'output' && companyId && (
          <FinalOutput companyId={companyId} />
        )}
        {role === 'admin' && screen === 'documents' && <DocumentManager />}
        {role === 'admin' && screen === 'users' && <UserManagement />}

        {role === 'employee' && screen === 'chat' && <ComplianceChat />}
        {role === 'employee' && screen === 'training' && <TrainingDashboard />}
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
  return isSignedIn ? <AuthedApp /> : <LoginPage />;
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
