import { useState } from 'react';
import Onboarding from './screens/Onboarding';
import Generation from './screens/Generation';
import ReviewDashboard from './screens/ReviewDashboard';
import FinalOutput from './screens/FinalOutput';

type Screen = 'onboarding' | 'generation' | 'review' | 'output';

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [companyId, setCompanyId] = useState<string>('');

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {screen === 'onboarding' && (
        <Onboarding
          onCompanyCreated={(id) => { setCompanyId(id); setScreen('generation'); }}
        />
      )}
      {screen === 'generation' && companyId && (
        <Generation
          companyId={companyId}
          onComplete={() => setScreen('review')}
        />
      )}
      {screen === 'review' && companyId && (
        <ReviewDashboard
          companyId={companyId}
          onFinish={() => setScreen('output')}
        />
      )}
      {screen === 'output' && companyId && (
        <FinalOutput companyId={companyId} />
      )}
    </div>
  );
}
