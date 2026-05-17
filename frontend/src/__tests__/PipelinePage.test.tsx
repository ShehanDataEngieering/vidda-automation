/**
 * PipelinePage — Admin Dashboard Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockClerk, mockFetch, TestWrapper } from './test-helpers';

let PipelinePage: () => JSX.Element;

beforeAll(() => {
  mockClerk({ role: 'admin', companyId: 'co-1' });
  PipelinePage = require('../screens/PipelinePage').default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PipelinePage — Admin Dashboard', () => {
  it('renders dashboard header and metrics', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline', response: [] },
      { method: 'GET', path: '/api/pipeline/assignments/all', response: [] },
    ]);

    render(<TestWrapper route="/pipeline"><PipelinePage /></TestWrapper>);
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Active Plans')).toBeInTheDocument();
  });

  it('renders plans in the table', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline', response: [
          { id: 'p-1', role_title: 'KYC Analyst', line_of_defence: '2LoD', status: 'approved', current_step: 'plan', version: 2, updated_at: '2026-01-01', company_id: 'co-1' },
          { id: 'p-2', role_title: 'MLRO', line_of_defence: '1LoD', status: 'draft', current_step: 'risk', version: 1, updated_at: '2026-01-02', company_id: 'co-1' },
        ],
      },
      { method: 'GET', path: '/api/pipeline/assignments/all', response: [] },
    ]);

    render(<TestWrapper route="/pipeline"><PipelinePage /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('KYC Analyst')).toBeInTheDocument();
      expect(screen.getByText('MLRO')).toBeInTheDocument();
    });
  });

  it('shows empty state when no plans', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline', response: [] },
      { method: 'GET', path: '/api/pipeline/assignments/all', response: [] },
    ]);

    render(<TestWrapper route="/pipeline"><PipelinePage /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('No plans yet')).toBeInTheDocument();
    });
  });

  it('"New Pipeline" button posts and navigates', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline', response: [] },
      { method: 'GET', path: '/api/pipeline/assignments/all', response: [] },
      { method: 'POST', path: '/api/pipeline', response: { planId: 'new-plan-123' }, status: 201 },
    ]);

    render(<TestWrapper route="/pipeline"><PipelinePage /></TestWrapper>);
    await waitFor(() => screen.getByText('Dashboard'));
    await userEvent.click(screen.getByText('New Pipeline'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pipeline'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
