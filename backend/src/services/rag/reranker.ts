import { VoyageAIClient } from 'voyageai';
import { logger } from '../../utils/logger';

// Lazy init — client created on first call so dotenv has already run
let _client: VoyageAIClient | null = null;
const getClient = () => {
  if (!_client) _client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' });
  return _client;
};
const MODEL = 'rerank-2';

interface RerankItem { relevanceScore?: number; index?: number; }

export async function rerankResults<T extends { content: string }>(
  query: string,
  results: T[],
  topK: number,
): Promise<T[]> {
  if (results.length === 0) return [];
  const clipped = results.slice(0, 100);
  const res = await getClient().rerank({
    query,
    documents: clipped.map(r => r.content),
    model: MODEL,
    topK: Math.min(topK, clipped.length),
  });
  const reranked = ((res.data ?? []) as RerankItem[])
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .map(item => clipped[item.index ?? -1])
    .filter((x): x is T => x !== undefined);
  logger.debug('Reranking done', { input: clipped.length, output: reranked.length });
  return reranked;
}
