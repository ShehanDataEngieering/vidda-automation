import { VoyageAIClient } from 'voyageai';
import { logger } from '../utils/logger';

const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' });
const MODEL = 'voyage-finance-2';
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = Number(process.env.EMBED_BATCH_DELAY_MS ?? 200);

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await client.embed({ input: batch, model: MODEL });
    const vecs = (res.data ?? []).map((d: { embedding?: number[] }) => d.embedding ?? []);
    results.push(...vecs);
    logger.debug('Embeddings batch done', { batch: Math.floor(i / BATCH_SIZE) + 1, count: batch.length });
    if (i + BATCH_SIZE < texts.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const vecs = await embedTexts([text]);
  return vecs[0] ?? [];
}
