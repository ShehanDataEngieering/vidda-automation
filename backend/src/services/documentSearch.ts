import { db as pool } from '../db/client';

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

/**
 * Two-stage retrieval:
 * 1. BM25+FTS top-5 direct matches scoped to company's document_chunks
 * 2. Follow chunk_relationships edges (1 hop) to pull in referenced chunks
 */
export async function searchDocumentChunks(
  query: string,
  companyId: string,
  topK = 5,
): Promise<DocSearchResult[]> {
  const sanitised = query.replace(/[^\w\s]/g, ' ').trim();
  const tsQuery = sanitised.split(/\s+/).filter(Boolean).join(' & ');

  let directRows: Array<{
    id: string;
    document_id: string;
    display_name: string;
    section_heading: string | null;
    section_number: string | null;
    page_number: number | null;
    content: string;
    bm25: number;
  }> = [];

  if (tsQuery) {
    const { rows } = await pool.query(
      `SELECT
         dc.id,
         dc.document_id,
         d.display_name,
         dc.section_heading,
         dc.section_number,
         dc.page_number,
         dc.content,
         ts_rank_cd(to_tsvector('english', dc.content), to_tsquery('english', $1)) AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.company_id = $2
         AND d.status = 'ready'
         AND to_tsvector('english', dc.content) @@ to_tsquery('english', $1)
       ORDER BY bm25 DESC
       LIMIT $3`,
      [tsQuery, companyId, topK],
    );
    directRows = rows;
  }

  // Fallback: return most recent chunks if FTS returned nothing
  if (directRows.length === 0) {
    const { rows } = await pool.query(
      `SELECT
         dc.id,
         dc.document_id,
         d.display_name,
         dc.section_heading,
         dc.section_number,
         dc.page_number,
         dc.content,
         0 AS bm25
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.company_id = $1 AND d.status = 'ready'
       ORDER BY dc.created_at DESC
       LIMIT $2`,
      [companyId, topK],
    );
    directRows = rows;
  }

  const directIds = new Set(directRows.map(r => r.id));
  const results: DocSearchResult[] = directRows.map(r => ({
    id: r.id,
    documentId: r.document_id,
    documentName: r.display_name,
    sectionHeading: r.section_heading,
    sectionNumber: r.section_number,
    pageNumber: r.page_number,
    content: r.content,
    bm25Score: Number(r.bm25),
    finalScore: Number(r.bm25),
    isLinked: false,
  }));

  // 1-hop expansion via chunk_relationships
  if (directIds.size > 0) {
    const idList = Array.from(directIds);
    const { rows: linkedRows } = await pool.query(
      `SELECT
         dc.id,
         dc.document_id,
         d.display_name,
         dc.section_heading,
         dc.section_number,
         dc.page_number,
         dc.content
       FROM chunk_relationships cr
       JOIN document_chunks dc ON dc.id = cr.target_chunk_id
       JOIN documents d ON d.id = dc.document_id
       WHERE cr.source_chunk_id = ANY($1::uuid[])
         AND dc.company_id = $2
         AND d.status = 'ready'`,
      [idList, companyId],
    );

    for (const row of linkedRows) {
      if (!directIds.has(row.id)) {
        directIds.add(row.id);
        results.push({
          id: row.id,
          documentId: row.document_id,
          documentName: row.display_name,
          sectionHeading: row.section_heading,
          sectionNumber: row.section_number,
          pageNumber: row.page_number,
          content: row.content,
          bm25Score: 0,
          finalScore: 0,
          isLinked: true,
        });
      }
    }
  }

  // JS rerank: linked chunks get a small boost over pure fallback, but below direct hits
  results.sort((a, b) => {
    const scoreA = a.bm25Score + (a.isLinked ? 0.1 : 0);
    const scoreB = b.bm25Score + (b.isLinked ? 0.1 : 0);
    return scoreB - scoreA;
  });

  return results.slice(0, topK + 3); // allow a few linked extras
}
