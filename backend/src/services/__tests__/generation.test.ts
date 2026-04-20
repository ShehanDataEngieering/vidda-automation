import { streamModule } from '../generation';
import type Anthropic from '@anthropic-ai/sdk';
import type { Chunk } from '../vectorSearch';

function makeChunks(): Chunk[] {
  return [
    { id: '1', regulation_name: 'GDPR', article_reference: 'Article 5', content: 'Data minimisation principle.' },
  ];
}

function makeMockAnthropic(texts: string[]): Anthropic {
  async function* fakeStream() {
    for (const text of texts) {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
    }
  }
  return {
    messages: {
      stream: jest.fn().mockReturnValue(fakeStream()),
    },
  } as unknown as Anthropic;
}

async function collectOutput(gen: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

function getPrompt(anthropic: Anthropic): string {
  return (anthropic.messages.stream as jest.Mock).mock.calls[0][0].messages[0].content as string;
}

describe('streamModule', () => {
  it('prompt sent to Claude contains the regulation name', async () => {
    const anthropic = makeMockAnthropic([]);
    await collectOutput(streamModule(anthropic, 'GDPR', 'All roles', makeChunks()));
    expect(getPrompt(anthropic)).toContain('GDPR');
  });

  it('prompt contains the role', async () => {
    const anthropic = makeMockAnthropic([]);
    await collectOutput(streamModule(anthropic, 'GDPR', 'Compliance Officer', makeChunks()));
    expect(getPrompt(anthropic)).toContain('Compliance Officer');
  });

  it('yields text deltas from the stream', async () => {
    const anthropic = makeMockAnthropic(['Hello', ' world']);
    const output = await collectOutput(streamModule(anthropic, 'GDPR', 'All roles', makeChunks()));
    expect(output).toEqual(['Hello', ' world']);
  });

  it('includes rejection reason in prompt when provided', async () => {
    const anthropic = makeMockAnthropic([]);
    await collectOutput(streamModule(anthropic, 'GDPR', 'All roles', makeChunks(), 'Too vague'));
    expect(getPrompt(anthropic)).toContain('Too vague');
  });

  it('does not include rejection block when reason is absent', async () => {
    const anthropic = makeMockAnthropic([]);
    await collectOutput(streamModule(anthropic, 'GDPR', 'All roles', makeChunks()));
    expect(getPrompt(anthropic)).not.toContain('rejected');
  });
});
