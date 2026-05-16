import { VoyageAIClient } from 'voyageai';
import { logger } from '../../utils/logger';

let _client: VoyageAIClient | null = null;
const getClient = () => {
  if (!_client) _client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' });
  return _client;
};
const MODEL = 'rerank-2';
const MIN_CONFIDENCE = 0.05;

interface RerankItem { relevanceScore?: number; index?: number; }

export interface RerankedResult<T> {
  item: T;
  score: number;
}

export async function rerankResults<T extends { content: string }>(
  query: string,
  results: T[],
  topK: number,
): Promise<RerankedResult<T>[]> {
  if (results.length === 0) return [];
  const clipped = results.slice(0, 100);

  try {
    const res = await getClient().rerank({
      query,
      documents: clipped.map(r => r.content),
      model: MODEL,
      topK: Math.min(topK, clipped.length),
    });

    const reranked = ((res.data ?? []) as RerankItem[])
      .map(item => {
        const idx = item.index ?? -1;
        const target = clipped[idx];
        if (!target) return null;
        return { item: target, score: item.relevanceScore ?? 0 };
      })
      .filter((x): x is RerankedResult<T> => x !== null)
      .sort((a, b) => b.score - a.score)
      .filter(r => r.score >= MIN_CONFIDENCE)
      .slice(0, topK);

    logger.debug('Reranking done', { input: clipped.length, output: reranked.length });
    return reranked;
  } catch (err) {
    logger.warn('Reranking failed, returning original order', { error: String(err) });
    return clipped.slice(0, topK).map(item => ({ item, score: 0.5 }));
  }
}
