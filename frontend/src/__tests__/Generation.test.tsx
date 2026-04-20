import { render, screen, act } from '@testing-library/react';
import Generation from '../screens/Generation';

function makeStream(events: object[]): Response {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const encoded = new TextEncoder().encode(lines);

  const body = {
    getReader: () => ({
      read: jest.fn()
        .mockResolvedValueOnce({ value: encoded, done: false })
        .mockResolvedValue({ value: undefined, done: true }),
    }),
  };

  return { ok: true, body } as unknown as Response;
}

describe('Generation', () => {
  it('renders all four pipeline stage labels', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeStream([{ type: 'done' }])) as jest.Mock;
    await act(async () => { render(<Generation companyId="abc" />); });
    for (const label of ['Gap analysis', 'Vector search', 'Generating', 'Scoring']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders a module card when module_start event is received', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream([
        { type: 'module_start', regulation: 'GDPR', role: 'All roles', moduleId: 'm1' },
        { type: 'done' },
      ])
    ) as jest.Mock;
    await act(async () => { render(<Generation companyId="abc" />); });
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('All roles')).toBeInTheDocument();
  });

  it('appends streamed content to the module card', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream([
        { type: 'module_start', regulation: 'AML', role: 'Front Office', moduleId: 'm2' },
        { type: 'chunk', content: 'Hello', moduleId: 'm2' },
        { type: 'chunk', content: ' world', moduleId: 'm2' },
        { type: 'done' },
      ])
    ) as jest.Mock;
    await act(async () => { render(<Generation companyId="abc" />); });
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
  });

  it('shows quality score badge when module_done event is received', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream([
        { type: 'module_start', regulation: 'GDPR', role: 'All roles', moduleId: 'm3' },
        { type: 'module_done', moduleId: 'm3', qualityScore: 80 },
        { type: 'done' },
      ])
    ) as jest.Mock;
    await act(async () => { render(<Generation companyId="abc" />); });
    expect(screen.getByText(/Quality 80\/100/)).toBeInTheDocument();
  });

  it('shows error message when error event is received', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream([{ type: 'error', message: 'Generation pipeline failed' }])
    ) as jest.Mock;
    await act(async () => { render(<Generation companyId="abc" />); });
    expect(screen.getByText(/Generation pipeline failed/)).toBeInTheDocument();
  });
});
