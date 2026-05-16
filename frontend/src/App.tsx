import { useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, useUser, ClerkLoaded } from '@clerk/react';
import { Shield } from 'lucide-react';
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
import PipelinePage from './screens/PipelinePage';

// Role gate components — restrict render by Clerk role metadata
function RoleGate({ role, allowed, children }: { role: 'admin' | 'employee'; allowed: 'admin' | 'employee'; children: ReactNode }) {
  if (role !== allowed) return null;
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
  const role = (user?.publicMetadata?.role as 'admin' | 'employee' | undefined) ?? 'employee';

  const [companyId, setCompanyId] = useState<string>(clerkCompanyId);

  return (
    <div className="flex min-h-screen bg-background">
      <NavBar role={role} />
      <main className="ml-56 flex-1 min-h-screen">
        <Routes>
          {/* Home — redirect to pipeline for admin, training for employee */}
          <Route path="/" element={
            role === 'admin'
              ? <Navigate to="/pipeline" replace />
              : <Navigate to="/lms/my-training" replace />
          } />

          {/* New pipeline routes */}
          <Route path="/pipeline" element={<AdminGate role={role}><PipelinePage /></AdminGate>} />

          {/* Old screens — keep working during transition */}
          <Route path="/setup" element={<AdminGate role={role}>
            <Onboarding onCompanyCreated={(id) => { setCompanyId(id); }} />
          </AdminGate>} />
          <Route path="/generate" element={companyId ? <Generation companyId={companyId} onComplete={() => {}} /> : <Navigate to="/setup" />} />
          <Route path="/review" element={companyId ? <ReviewDashboard companyId={companyId} onFinish={() => {}} /> : <Navigate to="/setup" />} />
          <Route path="/output" element={companyId ? <FinalOutput companyId={companyId} /> : <Navigate to="/setup" />} />
          <Route path="/documents" element={<AdminGate role={role}><DocumentManager /></AdminGate>} />
          <Route path="/users" element={<AdminGate role={role}><UserManagement /></AdminGate>} />

          {/* Employee routes */}
          <Route path="/chat" element={<EmployeeGate role={role}><ComplianceChat /></EmployeeGate>} />
          <Route path="/training" element={<EmployeeGate role={role}><TrainingDashboard /></EmployeeGate>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
        <SignIn
          appearance={{
            elements: {
              footerAction: { display: 'none' },
              footer: { display: 'none' },
            },
          }}
        />
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

  if (!isSignedIn) return <LoginPage />;

  return (
    <ErrorBoundary>
      <AuthedApp />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vidda-theme">
      <ClerkLoaded>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </ClerkLoaded>
    </ThemeProvider>
  );
}
