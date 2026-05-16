// Placeholder for RoleImport screen — will be fully built in Branch 1
// This exists in Branch 0 so the React Router can render a working route

import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PipelinePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const companyId = (user?.publicMetadata?.companyId as string | undefined) ?? '';
  const role = (user?.publicMetadata?.role as string) ?? 'employee';

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-lg font-semibold mb-2">Training Plan Pipeline</h1>
      <p className="text-sm text-muted-foreground mb-6">
        AMLR 2024/1624 compliance training generator. Role import → Risk → AMLR mapping → Plan → LMS.
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Start New Training Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Import a role description to generate a role-specific, risk-based AMLR compliance training plan.
          </p>
          {companyId ? (
            <Button onClick={() => navigate('/pipeline/new')}>
              New Plan — Role Import
            </Button>
          ) : (
            <p className="text-sm text-destructive">Create a company first in Setup.</p>
          )}
        </CardContent>
      </Card>

      {role === 'employee' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">My Training</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View your assigned AMLR training plan.
            </p>
            <Button variant="outline" onClick={() => navigate('/lms/my-training')}>
              My Training Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
