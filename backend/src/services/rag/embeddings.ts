import { VoyageAIClient } from 'voyageai';
import { logger } from '../../utils/logger';
import * as embedCache from './embeddingCache';

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

  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = embedCache.getCachedEmbedding(texts[i]!);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]!);
    }
  }

  if (uncachedTexts.length === 0) return results;

  const totalBatches = Math.ceil(uncachedTexts.length / BATCH_SIZE);
  for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
    const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    logger.debug(`Embedding batch ${batchNum}/${totalBatches}`, { count: batch.length, cacheHits: texts.length - uncachedTexts.length });
    const vecs = await embedBatch(batch);
    for (let j = 0; j < vecs.length; j++) {
      const origIdx = uncachedIndices[i + j]!;
      results[origIdx] = vecs[j]!;
      embedCache.setCachedEmbedding(uncachedTexts[j]!, vecs[j]!);
    }
    if (i + BATCH_SIZE < uncachedTexts.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const vecs = await embedTexts([text]);
  return vecs[0] ?? [];
}
