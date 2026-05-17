import { type ReactNode } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Mock Clerk — must be set before any component uses @clerk/react
 */
export interface ClerkUserOverrides {
  role?: 'admin' | 'employee';
  companyId?: string;
  employeeRole?: string;
  userId?: string;
}

export function mockClerk(overrides: ClerkUserOverrides = {}) {
  const userMeta = {
    role: overrides.role ?? 'admin',
    companyId: overrides.companyId ?? 'test-company-id',
    employeeRole: overrides.employeeRole ?? null,
  };

  jest.mock('@clerk/react', () => ({
    useUser: () => ({
      user: {
        id: overrides.userId ?? 'test-user-id',
        publicMetadata: userMeta,
      },
      isLoaded: true,
      isSignedIn: true,
    }),
    useAuth: () => ({
      getToken: jest.fn().mockResolvedValue('mock-clerk-token'),
      isLoaded: true,
      isSignedIn: true,
    }),
    ClerkLoaded: ({ children }: { children: ReactNode }) => <>{children}</>,
    UserButton: () => <div data-testid="user-button" />,
    SignIn: () => <div data-testid="sign-in" />,
  }));
}

/**
 * Mock fetch — returns controlled JSON responses
 */
export interface MockEndpoint {
  method: string;
  path: string;
  response: unknown;
  status?: number;
}

export function mockFetch(endpoints: MockEndpoint[]) {
  global.fetch = jest.fn().mockImplementation(
    (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      const match = endpoints.find(
        e => e.method === method && e.path === path
      );
      if (match) {
        return Promise.resolve({
          ok: match.status === undefined || match.status < 400,
          status: match.status ?? 200,
          json: () => Promise.resolve(match.response),
          text: () => Promise.resolve(typeof match.response === 'string' ? match.response : JSON.stringify(match.response)),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: `not mocked: ${method} ${path}` }),
      } as Response);
    }
  );
}

/**
 * Wraps children in MemoryRouter with a catch-all route so useParams() works.
 * Set routePattern to define named params (e.g. "/pipeline/:planId").
 */
export function TestWrapper({
  children,
  route = '/',
  pattern,
}: {
  children: ReactNode;
  route?: string;
  pattern?: string;
}) {
  const p = pattern ?? route;
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={p} element={children} />
      </Routes>
    </MemoryRouter>
  );
}
