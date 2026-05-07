import { db } from '../../db/client';
import type { SearchResult } from '../../types';
import { embedText } from './embeddings';
import { rerankResults } from './reranker';
import { logger } from '../../utils/logger';

interface DbChunkRow {
  id: string;
  regulation: string;
  article_number: string | null;
  article_reference: string;
  entities: string[];
  content: string;
  bm25_score: string;
}

function toSearchResult(row: DbChunkRow, finalScore: number): SearchResult {
  return {
    id: String(row.id),
    regulation: String(row.regulation),
    article_number: String(row.article_number ?? ''),
    article_reference: String(row.article_reference),
    entities: Array.isArray(row.entities) ? row.entities : [],
    content: String(row.content),
    bm25Score: Number(row.bm25_score) || 0,
    finalScore,
  };
}

export async function searchChunks(
  regulation: string,
  role: string,
  topK = 5,
): Promise<SearchResult[]> {
  const searchTerm = `${regulation} compliance ${role}`;

  // ── BM25 path ──────────────────────────────────────────────────────────────
  const bm25Res = await db.query<DbChunkRow>(
    `SELECT id, regulation, article_number, article_reference, entities, content,
       ts_rank(
         to_tsvector('english', content || ' ' || COALESCE(array_to_string(entities, ' '), '')),
         plainto_tsquery('english', $1)
       ) AS bm25_score
     FROM regulatory_chunks
     WHERE regulation = $2
       AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
     ORDER BY bm25_score DESC
     LIMIT 15`,
    [searchTerm, regulation],
  );

  const bm25Rank = new Map<string, number>();
  bm25Res.rows.forEach((r, i) => bm25Rank.set(r.id, i + 1));

  // ── Vector path ────────────────────────────────────────────────────────────
  const vectorRank = new Map<string, number>();
  try {
    const queryVec = await embedText(searchTerm);
    const vecStr = `[${queryVec.join(',')}]`;
    const vecRes = await db.query<{ id: string }>(
      `SELECT id
       FROM regulatory_chunks
       WHERE regulation = $1 AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector
       LIMIT 15`,
      [regulation, vecStr],
    );
    vecRes.rows.forEach((r, i) => vectorRank.set(r.id, i + 1));
  } catch (err) {
    logger.warn('Vector search skipped', { error: String(err) });
  }

  const bm25Hits = bm25Rank.size;
  const vectorHits = vectorRank.size;

  // ── RRF fusion ─────────────────────────────────────────────────────────────
  const allIds = new Set([...bm25Rank.keys(), ...vectorRank.keys()]);
  const rrfScores: { id: string; rrf: number }[] = [];
  for (const id of allIds) {
    const bRank = bm25Rank.get(id) ?? 9999;
    const vRank = vectorRank.get(id) ?? 9999;
    rrfScores.push({ id, rrf: 1 / (60 + bRank) + 1 / (60 + vRank) });
  }
  rrfScores.sort((a, b) => b.rrf - a.rrf);
  const top15Ids = rrfScores.slice(0, 15).map(x => x.id);

  // Fetch full rows for top-15
  if (top15Ids.length === 0) {
    const fallback = await db.query<DbChunkRow>(
      `SELECT id, regulation, article_number, article_reference, entities, content, 0.1 AS bm25_score
       FROM regulatory_chunks WHERE regulation = $1 LIMIT $2`,
      [regulation, topK],
    );
    return fallback.rows.map(r => toSearchResult(r, 0.1));
  }

  const fullRes = await db.query<DbChunkRow>(
    `SELECT id, regulation, article_number, article_reference, entities, content,
       ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) AS bm25_score
     FROM regulatory_chunks
     WHERE id = ANY($1)`,
    [top15Ids, searchTerm],
  );

  // Sort by RRF order before reranking
  const idToRow = new Map(fullRes.rows.map(r => [r.id, r]));
  const ordered = top15Ids.map(id => idToRow.get(id)).filter((r): r is DbChunkRow => !!r);

  // ── Voyage reranking ───────────────────────────────────────────────────────
  const reranked = await rerankResults(searchTerm, ordered, Math.min(topK + 3, ordered.length));

  logger.debug('vectorSearch done', { regulation, role, bm25Hits, vectorHits, rrfCandidates: allIds.size, reranked: reranked.length });

  return reranked.map((r, i) => toSearchResult(r, 1 - i * 0.05)).slice(0, topK);
}
