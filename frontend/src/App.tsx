import { useState } from 'react';
import { SignIn, useUser, ClerkLoaded } from '@clerk/react';
import NavBar from './components/NavBar';
import Onboarding from './screens/Onboarding';
import Generation from './screens/Generation';
import ReviewDashboard from './screens/ReviewDashboard';
import FinalOutput from './screens/FinalOutput';
import DocumentManager from './screens/DocumentManager';
import ComplianceChat from './screens/ComplianceChat';
import TrainingDashboard from './screens/TrainingDashboard';

type AdminScreen = 'onboarding' | 'generation' | 'review' | 'output' | 'documents';
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
    <div className="min-h-screen bg-[#0F172A] text-white flex">
      <NavBar role={role} screen={screen} onNavigate={setScreen} />

      <main className="ml-[220px] flex-1 min-h-screen overflow-y-auto">
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

        {role === 'employee' && screen === 'chat' && <ComplianceChat />}
        {role === 'employee' && screen === 'training' && <TrainingDashboard />}
      </main>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500 mb-4">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">Vidda</h1>
          <p className="text-slate-400 text-sm mt-1">Compliance Training Platform</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[#1E293B] border border-white/10 shadow-xl rounded-2xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-slate-400',
              formFieldLabel: 'text-slate-300 text-sm',
              formFieldInput:
                'bg-[#0F172A] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500',
              formButtonPrimary:
                'bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg',
              footerActionLink: 'text-indigo-400 hover:text-indigo-300',
              dividerLine: 'bg-white/10',
              dividerText: 'text-slate-500',
              socialButtonsBlockButton:
                'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10',
            },
          }}
        />
      </div>
    </div>
  );
}

function AppInner() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return isSignedIn ? <AuthedApp /> : <LoginPage />;
}

export default function App() {
  return (
    <ClerkLoaded>
      <AppInner />
    </ClerkLoaded>
  );
}
