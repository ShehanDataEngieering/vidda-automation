import { useState } from 'react';
import Onboarding from './screens/Onboarding';
import Generation from './screens/Generation';

type Screen = 'onboarding' | 'generation';

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [companyId, setCompanyId] = useState<string>('');

  function handleCompanyCreated(id: string) {
    setCompanyId(id);
    setScreen('generation');
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {screen === 'onboarding' && (
        <Onboarding onCompanyCreated={handleCompanyCreated} />
      )}
      {screen === 'generation' && companyId && (
        <Generation companyId={companyId} />
      )}
    </div>
  );
}
