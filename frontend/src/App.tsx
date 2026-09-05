import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useUser, ClerkLoaded } from '@clerk/react';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LogoTile } from '@/components/Logo';
import NavBar from './components/NavBar';
import Home from './screens/Home';
import CompanyOnboarding from './screens/CompanyOnboarding';
import UserManagement from './screens/UserManagement';
import PipelinePage from './screens/PipelinePage';
import RoleImport from './screens/RoleImport';
import RiskAssessment from './screens/RiskAssessment';
import AMLRMapping from './screens/AMLRMapping';
import TrainingPlan from './screens/TrainingPlan';
import LMSView from './screens/LMSView';
import LMSDashboard from './screens/LMSDashboard';

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
  const role = (user?.publicMetadata?.role as 'admin' | 'employee' | undefined) ?? 'employee';

  return (
    <div className="flex min-h-screen bg-background">
      <NavBar role={role} />
      <main className="flex-1 min-h-screen pt-14 lg:pt-0 lg:ml-56">
        <Routes>
          {/* Home — redirect to pipeline for admin, training for employee */}
          <Route path="/" element={
            role === 'admin'
              ? <Navigate to="/pipeline" replace />
              : <Navigate to="/lms/my-training" replace />
          } />

          {/* New pipeline routes */}
          <Route path="/pipeline" element={<AdminGate role={role}><PipelinePage /></AdminGate>} />
          <Route path="/pipeline/new" element={<AdminGate role={role}><RoleImport /></AdminGate>} />
          <Route path="/pipeline/:planId" element={<AdminGate role={role}><RoleImport /></AdminGate>} />
          <Route path="/pipeline/:planId/risk" element={<AdminGate role={role}><RiskAssessment /></AdminGate>} />
          <Route path="/pipeline/:planId/amlr" element={<AdminGate role={role}><AMLRMapping /></AdminGate>} />
          <Route path="/pipeline/:planId/plan" element={<AdminGate role={role}><TrainingPlan /></AdminGate>} />
          <Route path="/pipeline/:planId/lms" element={<AdminGate role={role}><LMSView /></AdminGate>} />

          {/* Employee LMS */}
          <Route path="/lms/my-training" element={<EmployeeGate role={role}><LMSDashboard /></EmployeeGate>} />

          {/* Utility screens */}
          <Route path="/users" element={<AdminGate role={role}><UserManagement /></AdminGate>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <LogoTile size={40} />
          <h1 className="text-xl font-semibold">Vidda Compliance</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <LogoTile size={40} />
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="text-sm text-muted-foreground">Set up Vidda for your organization</p>
        </div>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </div>
  );
}

// Unauthenticated visitors: marketing page + Clerk auth screens.
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppInner() {
  const { isSignedIn, isLoaded, user } = useUser();

  if (!isLoaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );

  if (!isSignedIn) return <PublicRoutes />;

  // Signed in but no company yet (fresh self-serve signup) — onboarding gate
  // takes over every route until they've created a company profile.
  const companyId = user?.publicMetadata?.['companyId'] as string | undefined;
  if (!companyId) return <CompanyOnboarding />;

  return (
    <ErrorBoundary>
      <AuthedApp />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vidda-theme">
      <TooltipProvider delayDuration={200}>
        <ClerkLoaded>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </ClerkLoaded>
        <Toaster position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
