import { db as pool } from '../../db/client';
import { embedText } from './embeddings';
import { rerankResults } from './reranker';
import { logger } from '../../utils/logger';

export interface DocSearchResult {
  id: string;
  documentId: string;
  documentName: string;
  sectionHeading: string | null;
  sectionNumber: string | null;
  pageNumber: number | null;
  content: string;
  bm25Score: number;
  finalScore: number;
  isLinked: boolean;
}

interface DbChunkRow {
  id: string;
  document_id: string;
  display_name: string;
  section_heading: string | null;
  section_number: string | null;
  page_number: number | null;
  content: string;
  parent_chunk_id: string | null;
  bm25: string;
}

function toResult(row: DbChunkRow, finalScore: number, isLinked: boolean): DocSearchResult {
  return {
    id: row.id,
    documentId: row.document_id,
    documentName: row.display_name,
    sectionHeading: row.section_heading,
    sectionNumber: row.section_number,
    pageNumber: row.page_number,
    content: row.content,
    bm25Score: Number(row.bm25) || 0,
    finalScore,
    isLinked,
  };
}

export async function searchDocumentChunks(
  query: string,
  companyId: string,
  topK = 5,
): Promise<DocSearchResult[]> {
  const sanitised = query.replace(/[^\w\s]/g, ' ').trim();
  const tsQuery = sanitised.split(/\s+/).filter(Boolean).join(' & ');

  // ── BM25 on child chunks ──────────────────────────────────────────────────
  const bm25Rank = new Map<string, number>();
  let bm25Rows: DbChunkRow[] = [];

  if (tsQuery) {
    const { rows } = await pool.query<DbChunkRow>(
      `SELECT dc.id, dc.document_id, d.display_name, dc.section_heading,
              dc.section_number, dc.page_number, dc.content, dc.parent_chunk_id,
              ts_rank_cd(to_tsvector('english', dc.content), to_tsquery('english', $1)) AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.company_id = $2
         AND d.status = 'ready'
         AND COALESCE(dc.chunk_type, 'child') = 'child'
         AND to_tsvector('english', dc.content) @@ to_tsquery('english', $1)
       ORDER BY bm25 DESC
       LIMIT 15`,
      [tsQuery, companyId],
    );
    bm25Rows = rows;
    rows.forEach((r, i) => bm25Rank.set(r.id, i + 1));
  }

  // ── Vector on child chunks ────────────────────────────────────────────────
  const vectorRank = new Map<string, number>();
  try {
    const queryVec = await embedText(query);
    const vecStr = `[${queryVec.join(',')}]`;
    const { rows } = await pool.query<{ id: string }>(
      `SELECT dc.id
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.company_id = $1
         AND d.status = 'ready'
         AND COALESCE(dc.chunk_type, 'child') = 'child'
         AND dc.embedding IS NOT NULL
       ORDER BY dc.embedding <=> $2::vector
       LIMIT 15`,
      [companyId, vecStr],
    );
    rows.forEach((r, i) => vectorRank.set(r.id, i + 1));
  } catch (err) {
    logger.warn('Document vector search skipped', { error: String(err) });
  }

  const bm25Hits = bm25Rank.size;
  const vectorHits = vectorRank.size;

  // ── RRF fusion ─────────────────────────────────────────────────────────────
  const allIds = new Set([...bm25Rank.keys(), ...vectorRank.keys()]);

  // Fallback: no matches at all
  if (allIds.size === 0) {
    const { rows } = await pool.query<DbChunkRow>(
      `SELECT dc.id, dc.document_id, d.display_name, dc.section_heading,
              dc.section_number, dc.page_number, dc.content, dc.parent_chunk_id,
              0 AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.company_id = $1 AND d.status = 'ready'
       ORDER BY dc.created_at DESC
       LIMIT $2`,
      [companyId, topK],
    );
    return rows.map(r => toResult(r, 0.1, false));
  }

  const rrfScores = Array.from(allIds).map(id => ({
    id,
    rrf: 1 / (60 + (bm25Rank.get(id) ?? 9999)) + 1 / (60 + (vectorRank.get(id) ?? 9999)),
  })).sort((a, b) => b.rrf - a.rrf);

  const top15Ids = rrfScores.slice(0, 15).map(x => x.id);

  // Fetch full child rows
  const bm25RowMap = new Map(bm25Rows.map(r => [r.id, r]));
  const missingIds = top15Ids.filter(id => !bm25RowMap.has(id));

  if (missingIds.length > 0) {
    const { rows } = await pool.query<DbChunkRow>(
      `SELECT dc.id, dc.document_id, d.display_name, dc.section_heading,
              dc.section_number, dc.page_number, dc.content, dc.parent_chunk_id,
              0 AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.id = ANY($1)`,
      [missingIds],
    );
    rows.forEach(r => bm25RowMap.set(r.id, r));
  }

  const childRows = top15Ids.map(id => bm25RowMap.get(id)).filter((r): r is DbChunkRow => !!r);

  // ── Parent expansion ──────────────────────────────────────────────────────
  const parentIds = [...new Set(childRows.map(r => r.parent_chunk_id).filter((id): id is string => !!id))];
  const parentRowMap = new Map<string, DbChunkRow>();

  if (parentIds.length > 0) {
    const { rows } = await pool.query<DbChunkRow>(
      `SELECT dc.id, dc.document_id, d.display_name, dc.section_heading,
              dc.section_number, dc.page_number, dc.content, dc.parent_chunk_id,
              0 AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.id = ANY($1)`,
      [parentIds],
    );
    rows.forEach(r => parentRowMap.set(r.id, r));
  }

  // Build combined set: parents first (richer context), then orphan children
  const combined: DbChunkRow[] = [];
  const addedIds = new Set<string>();

  for (const child of childRows) {
    const parentId = child.parent_chunk_id;
    if (parentId) {
      const parent = parentRowMap.get(parentId);
      if (parent && !addedIds.has(parent.id)) {
        combined.push(parent);
        addedIds.add(parent.id);
      }
    } else if (!addedIds.has(child.id)) {
      combined.push(child);
      addedIds.add(child.id);
    }
  }

  // ── Voyage reranking ──────────────────────────────────────────────────────
  const reranked = await rerankResults(query, combined, Math.min(topK + 3, combined.length));

  logger.debug('documentSearch done', { query: query.slice(0, 60), bm25Hits, vectorHits, rrfCandidates: allIds.size, parents: parentIds.length, reranked: reranked.length });

  return reranked.map((r, i) => toResult(r, 1 - i * 0.05, parentRowMap.has(r.id))).slice(0, topK + 3);
}
