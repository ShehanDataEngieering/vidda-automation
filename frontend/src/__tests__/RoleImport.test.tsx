/**
 * RoleImport — Form, Analysis, Clarification Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockClerk, mockFetch, TestWrapper } from './test-helpers';

let RoleImport: () => JSX.Element;

beforeAll(() => {
  mockClerk({ role: 'admin', companyId: 'co-1' });
  RoleImport = require('../screens/RoleImport').default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const ROLE_PROFILE = {
  role_title: 'KYC Analyst',
  line_of_defence: '2LoD',
  classified_as: 'KYC Analyst',
  classification_confidence: 0.92,
  daily_activities: 'Review PEP files, validate ownership structures.',
  key_decisions: 'Accept/reject EDD documentation.',
  mistake_consequences: 'High-risk customers enter the bank undetected.',
};

describe('RoleImport — Landing (no planId)', () => {
  it('renders landing page with Start button', async () => {
    render(<TestWrapper route="/pipeline/new"><RoleImport /></TestWrapper>);
    expect(await screen.findByText('AMLR Training Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Start New Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Batch Import')).toBeInTheDocument();
  });

  it('displays pipeline step icons', async () => {
    render(<TestWrapper route="/pipeline/new"><RoleImport /></TestWrapper>);
    await screen.findByText('AMLR Training Pipeline');
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.getByText('AMLR')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('LMS')).toBeInTheDocument();
  });

  it('starts a pipeline on button click', async () => {
    mockFetch([
      { method: 'POST', path: '/api/pipeline', response: { planId: 'plan-abc' }, status: 201 },
    ]);

    render(<TestWrapper route="/pipeline/new"><RoleImport /></TestWrapper>);
    await screen.findByText('AMLR Training Pipeline');
    await userEvent.click(screen.getByText('Start New Pipeline'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pipeline'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

describe('RoleImport — Active Pipeline', () => {
  it('renders form with metadata fields', async () => {
    render(<TestWrapper route="/pipeline/plan-1" pattern="/pipeline/:planId"><RoleImport /></TestWrapper>);
    const heading = await screen.findByText('Role Import & Analysis');
    expect(heading).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. KYC Analyst')).toBeInTheDocument();
    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.getByText('Regulatory Scope')).toBeInTheDocument();
  });

  it('shows analysis after clicking Analyse Role', async () => {
    mockFetch([
      {
        method: 'POST', path: '/api/pipeline/plan-1/analyze-role',
        response: { roleProfile: ROLE_PROFILE, warnings: [] },
      },
    ]);

    render(<TestWrapper route="/pipeline/plan-1" pattern="/pipeline/:planId"><RoleImport /></TestWrapper>);
    await screen.findByText('Role Import & Analysis');

    const textarea = screen.getByPlaceholderText('Paste role description here…');
    await userEvent.type(textarea, 'KYC Analyst reviews high-risk clients.');
    await userEvent.click(screen.getByText('Analyse Role'));

    await waitFor(() => {
      expect(screen.getByText('Role Analysis Complete')).toBeInTheDocument();
      expect(screen.getAllByText('KYC Analyst').length).toBeGreaterThan(0);
      expect(screen.getByText('92%')).toBeInTheDocument();
    });
  });

  it('shows clarification questions after analysis', async () => {
    mockFetch([
      {
        method: 'POST', path: '/api/pipeline/plan-1/analyze-role',
        response: { roleProfile: ROLE_PROFILE, warnings: [] },
      },
    ]);

    render(<TestWrapper route="/pipeline/plan-1" pattern="/pipeline/:planId"><RoleImport /></TestWrapper>);
    await screen.findByText('Role Import & Analysis');

    const textarea = screen.getByPlaceholderText('Paste role description here…');
    await userEvent.type(textarea, 'KYC Analyst reviews high-risk clients.');
    await userEvent.click(screen.getByText('Analyse Role'));

    await waitFor(() => {
      expect(screen.getByText('AI Clarification')).toBeInTheDocument();
      expect(screen.getByText('Continue with Clarifications')).toBeInTheDocument();
    });
  });

  it('loads demo description on button click', async () => {
    render(<TestWrapper route="/pipeline/plan-1" pattern="/pipeline/:planId"><RoleImport /></TestWrapper>);
    await screen.findByText('Role Import & Analysis');
    await userEvent.click(screen.getByText('Load Example'));
    const ta = screen.getByPlaceholderText('Paste role description here…') as HTMLTextAreaElement;
    expect(ta.value).toContain('KYC Analyst');
    expect(ta.value).toContain('Enhanced Due Diligence');
  });

  it('shows error on failed analysis', async () => {
    mockFetch([
      {
        method: 'POST', path: '/api/pipeline/plan-1/analyze-role',
        response: { error: 'AI failed' }, status: 500,
      },
    ]);

    render(<TestWrapper route="/pipeline/plan-1" pattern="/pipeline/:planId"><RoleImport /></TestWrapper>);
    await screen.findByText('Role Import & Analysis');
    const ta = screen.getByPlaceholderText('Paste role description here…');
    await userEvent.type(ta, 'something');
    await userEvent.click(screen.getByText('Analyse Role'));

    await waitFor(() => {
      expect(screen.getByText('AI failed')).toBeInTheDocument();
    });
  });
});
