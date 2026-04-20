import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding from '../screens/Onboarding';

const noop = () => {};

describe('Onboarding', () => {
  it('renders the company name input', () => {
    render(<Onboarding onCompanyCreated={noop} />);
    expect(screen.getByPlaceholderText('Acme Financial Ltd')).toBeInTheDocument();
  });

  it('renders all five regulation checkboxes', () => {
    render(<Onboarding onCompanyCreated={noop} />);
    for (const reg of ['AML', 'KYC', 'GDPR', 'DORA', 'MiFID II']) {
      expect(screen.getByRole('checkbox', { name: reg })).toBeInTheDocument();
    }
  });

  it('shows a score slider when a regulation is checked', async () => {
    render(<Onboarding onCompanyCreated={noop} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'GDPR' }));
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('shows "gap detected" label when slider value is below 70', async () => {
    render(<Onboarding onCompanyCreated={noop} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'GDPR' }));
    expect(screen.getByText(/gap detected/i)).toBeInTheDocument();
  });

  it('shows validation error when submitting with no company name', async () => {
    render(<Onboarding onCompanyCreated={noop} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'GDPR' }));
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(screen.getByText(/enter a company name/i)).toBeInTheDocument();
  });

  it('calls onCompanyCreated with the returned companyId on successful submit', async () => {
    const onCreated = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ companyId: 'uuid-123' }),
    }) as jest.Mock;

    render(<Onboarding onCompanyCreated={onCreated} />);
    await userEvent.type(screen.getByPlaceholderText('Acme Financial Ltd'), 'Test Co');
    await userEvent.click(screen.getByRole('checkbox', { name: 'GDPR' }));
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(onCreated).toHaveBeenCalledWith('uuid-123');
  });
});
