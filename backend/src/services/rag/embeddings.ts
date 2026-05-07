import { VoyageAIClient } from 'voyageai';
import { logger } from '../../utils/logger';

// Lazy init — client created on first call so dotenv has already run
let _client: VoyageAIClient | null = null;
const getClient = () => {
  if (!_client) _client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' });
  return _client;
};
const MODEL = 'voyage-finance-2';
// Free tier: 3 RPM / 10K TPM. Paid tier: much higher.
// BATCH_SIZE=20 keeps each request ~2K tokens; BATCH_DELAY=22s = 2.7 RPM (safe for free tier).
// Override via env for paid accounts: EMBED_BATCH_SIZE=100 EMBED_BATCH_DELAY_MS=500
const BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE ?? 20);
const BATCH_DELAY_MS = Number(process.env.EMBED_BATCH_DELAY_MS ?? 22000);

async function embedBatch(batch: string[], attempt = 1): Promise<number[][]> {
  try {
    const res = await getClient().embed({ input: batch, model: MODEL });
    return (res.data ?? []).map((d: { embedding?: number[] }) => d.embedding ?? []);
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429 && attempt <= 5) {
      // 3 RPM free tier: wait 65s to fully reset the sliding window
      const wait = 65_000;
      logger.warn(`Rate limited (429) attempt ${attempt}/5 — waiting ${wait / 1000}s for window reset...`);
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
