/**
 * RiskAssessment — Heatmap, Cards, Override Modal Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockClerk, mockFetch, TestWrapper } from './test-helpers';

let RiskAssessment: () => JSX.Element;

beforeAll(() => {
  mockClerk({ role: 'admin', companyId: 'co-1' });
  RiskAssessment = require('../screens/RiskAssessment').default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const PLAN_BASE = {
  id: 'rp-1',
  role_title: 'KYC Analyst',
  role_profile: { role_title: 'KYC Analyst', classified_as: 'KYC Analyst' },
  risk_matrix: null,
  amlr_mappings: null,
  training_plan: null,
  company_id: 'co-1',
  current_step: 'risk',
  version: 1, status: 'draft',
  created_by: 'user-1', line_of_defence: '2LoD',
  role_description: null, reviewer: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

const RISK_MATRIX = [
  { dimension: 'AML Risk', score: 'High' as const, justification: 'High-risk customer base.' },
  { dimension: 'Sanctions Risk', score: 'Medium' as const, justification: 'PEP exposure.' },
  { dimension: 'Fraud Risk', score: 'Critical' as const, justification: 'High transaction volumes.' },
  { dimension: 'Documentation Risk', score: 'Low' as const, justification: 'Standard CDD.' },
  { dimension: 'Escalation Risk', score: 'High' as const, justification: '24h SAR obligation.' },
];

describe('RiskAssessment — No risk yet', () => {
  it('shows Run Assessment CTA', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline/rp-1', response: PLAN_BASE },
    ]);

    render(<TestWrapper route="/pipeline/rp-1/risk" pattern="/pipeline/:planId/risk"><RiskAssessment /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Run AI Risk Assessment')).toBeInTheDocument();
    });
  });

  it('runs assessment on button click', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline/rp-1', response: PLAN_BASE },
      {
        method: 'POST', path: '/api/pipeline/rp-1/assess-risk',
        response: { riskMatrix: [{ dimension: 'AML Risk', score: 'High', justification: 'Direct client contact.' }], warnings: [] },
      },
    ]);

    render(<TestWrapper route="/pipeline/rp-1/risk" pattern="/pipeline/:planId/risk"><RiskAssessment /></TestWrapper>);
    await waitFor(() => screen.getByText('Run AI Risk Assessment'));
    await userEvent.click(screen.getByText('Run Assessment'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/assess-risk'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

describe('RiskAssessment — With risk data', () => {
  it('shows heatmap with dimensions', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/rp-2', response: {
          ...PLAN_BASE, id: 'rp-2', risk_matrix: RISK_MATRIX,
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/rp-2/risk" pattern="/pipeline/:planId/risk"><RiskAssessment /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Risk Heatmap')).toBeInTheDocument();
      expect(screen.getByText('AML Risk')).toBeInTheDocument();
      expect(screen.getByText('Sanctions Risk')).toBeInTheDocument();
    });
  });

  it('shows distribution bar', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/rp-2', response: {
          ...PLAN_BASE, id: 'rp-2', risk_matrix: RISK_MATRIX,
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/rp-2/risk" pattern="/pipeline/:planId/risk"><RiskAssessment /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Distribution')).toBeInTheDocument();
      expect(screen.getByText('1 Low')).toBeInTheDocument();
      expect(screen.getByText('1 Medium')).toBeInTheDocument();
      expect(screen.getByText('2 High')).toBeInTheDocument();
      expect(screen.getByText('1 Critical')).toBeInTheDocument();
    });
  });

  it('toggles between heatmap and card view', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/rp-2', response: {
          ...PLAN_BASE, id: 'rp-2', risk_matrix: RISK_MATRIX.slice(0, 2),
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/rp-2/risk" pattern="/pipeline/:planId/risk"><RiskAssessment /></TestWrapper>);
    await waitFor(() => screen.getByText('Risk Heatmap'));
    await userEvent.click(screen.getByText('Card View'));
    await waitFor(() => {
      expect(screen.getByText('Heatmap')).toBeInTheDocument();
    });
  });
});
