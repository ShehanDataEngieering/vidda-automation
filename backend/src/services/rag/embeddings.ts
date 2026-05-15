import { VoyageAIClient } from 'voyageai';
import { logger } from '../../utils/logger';

// Lazy init — client created on first call so dotenv has already run
let _client: VoyageAIClient | null = null;
const getClient = () => {
  if (!_client) _client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' });
  return _client;
};
const MODEL = 'voyage-finance-2';
const EMBED_DIM = 1024;
const BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE ?? 20);
const BATCH_DELAY_MS = Number(process.env.EMBED_BATCH_DELAY_MS ?? 22000);

async function embedBatch(batch: string[], attempt = 1): Promise<number[][]> {
  try {
    const res = await getClient().embed({ input: batch, model: MODEL });
    const embedData = (res.data ?? []) as Array<{ embedding?: number[] }>;
    const vecs = embedData.map((d) => {
      const vec = d.embedding ?? [];
      if (vec.length > 0 && vec.length !== EMBED_DIM) {
        logger.warn('Embedding dimension mismatch', { expected: EMBED_DIM, got: vec.length });
      }
      return vec;
    });
    return vecs;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
    if ((status === 429 || (status !== undefined && status >= 500)) && attempt <= 5) {
      const wait = status === 429 ? 65_000 : Math.min(attempt * 5000, 30_000);
      logger.warn(`Embed batch error (${status}) attempt ${attempt}/5 — waiting ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      return embedBatch(batch, attempt + 1);
    }
    throw err;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE);
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    logger.debug(`Embedding batch ${batchNum}/${totalBatches}`, { count: batch.length });
    const vecs = await embedBatch(batch);
    results.push(...vecs);
    if (i + BATCH_SIZE < texts.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const vecs = await embedTexts([text]);
  return vecs[0] ?? [];
}
