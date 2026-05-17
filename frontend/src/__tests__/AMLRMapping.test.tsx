/**
 * AMLRMapping — Filter, Export, Article Map Tests
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockClerk, mockFetch, TestWrapper } from './test-helpers';

let AMLRMappingScreen: () => JSX.Element;

beforeAll(() => {
  mockClerk({ role: 'admin', companyId: 'co-1' });
  AMLRMappingScreen = require('../screens/AMLRMapping').default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const PLAN_BASE = {
  id: 'ap-1',
  role_title: 'KYC Analyst',
  role_profile: { role_title: 'KYC Analyst', classified_as: 'KYC Analyst' },
  risk_matrix: [{ dimension: 'AML Risk', score: 'High', justification: '' }],
  amlr_mappings: null,
  training_plan: null,
  company_id: 'co-1',
  current_step: 'amlr',
  version: 1, status: 'draft',
  created_by: 'user-1', line_of_defence: '2LoD',
  role_description: null, reviewer: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

const MOCK_MAPPINGS = [
  { article: 'Article 9', article_name: 'Customer Due Diligence', applies_because: 'Role performs CDD on high-risk clients.', training_obligation: 'Train on CDD documentation standards.' },
  { article: 'Article 12', article_name: 'Enhanced Due Diligence', applies_because: 'Handles PEP clients requiring EDD.', training_obligation: 'Train on EDD requirements and PEP handling.' },
  { article: 'Article 13', article_name: 'Simplified Due Diligence', applies_because: 'Low-risk clients only.', training_obligation: 'Train on SDD criteria.' },
];

describe('AMLRMapping — No mappings yet', () => {
  it('shows Run Mapping CTA', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline/ap-1', response: PLAN_BASE },
    ]);

    render(<TestWrapper route="/pipeline/ap-1/amlr" pattern="/pipeline/:planId/amlr"><AMLRMappingScreen /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Run AMLR Article Mapping')).toBeInTheDocument();
    });
  });

  it('runs AMLR mapping on click', async () => {
    mockFetch([
      { method: 'GET', path: '/api/pipeline/ap-1', response: PLAN_BASE },
      {
        method: 'POST', path: '/api/pipeline/ap-1/map-amlr',
        response: { amlrMappings: MOCK_MAPPINGS, warnings: [] },
      },
    ]);

    render(<TestWrapper route="/pipeline/ap-1/amlr" pattern="/pipeline/:planId/amlr"><AMLRMappingScreen /></TestWrapper>);
    await waitFor(() => screen.getByText('Run AMLR Article Mapping'));
    await userEvent.click(screen.getByText('Run Mapping'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/map-amlr'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

describe('AMLRMapping — With mappings', () => {
  it('renders article list', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/ap-2', response: {
          ...PLAN_BASE, id: 'ap-2', amlr_mappings: MOCK_MAPPINGS,
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/ap-2/amlr" pattern="/pipeline/:planId/amlr"><AMLRMappingScreen /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getByText('Customer Due Diligence')).toBeInTheDocument();
      expect(screen.getByText('Enhanced Due Diligence')).toBeInTheDocument();
    });
  });

  it('shows enforcement tier badges', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/ap-2', response: {
          ...PLAN_BASE, id: 'ap-2', amlr_mappings: MOCK_MAPPINGS,
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/ap-2/amlr" pattern="/pipeline/:planId/amlr"><AMLRMappingScreen /></TestWrapper>);
    await waitFor(() => {
      expect(screen.getAllByText('High enforcement').length).toBeGreaterThan(0);
      expect(screen.getByText('Low enforcement')).toBeInTheDocument();
    });
  });

  it('has export button', async () => {
    mockFetch([
      {
        method: 'GET', path: '/api/pipeline/ap-2', response: {
          ...PLAN_BASE, id: 'ap-2', amlr_mappings: MOCK_MAPPINGS,
        },
      },
    ]);

    render(<TestWrapper route="/pipeline/ap-2/amlr" pattern="/pipeline/:planId/amlr"><AMLRMappingScreen /></TestWrapper>);
    await waitFor(() => screen.getByText('Customer Due Diligence'));
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
