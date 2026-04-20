/**
 * Retrieves the most relevant regulatory chunks for a given regulation + role.
 *
 * Week 1: Uses PostgreSQL full-text search (FTS) with ts_rank ordering.
 *   No embeddings required — works immediately with the seeded sample data.
 *
 * Week 2 upgrade path: Replace the FTS query body with:
 *   SELECT ... FROM regulatory_chunks
 *   ORDER BY embedding <=> $1 LIMIT $2
 *   and pass a real 1536-dim embedding vector from OpenAI text-embedding-3-small.
 *   Uncomment the ivfflat index in schema.sql first.
 *
 * `db` is injected rather than imported from client.ts so this function
 * is unit-testable without a live Supabase connection.
 */
import type { Pool } from 'pg';

export interface Chunk {
  id: string;
  regulation_name: string;
  article_reference: string;
  content: string;
}

export async function searchChunks(
  db: Pool,
  regulation: string,
  role: string,
  limit = 5
): Promise<Chunk[]> {
  // Combine regulation + role into the FTS query so results are biased toward
  // content that is both regulation-specific and role-relevant
  const ftsQuery = `${regulation} ${role} compliance`;

  const result = await db.query<Chunk>(
    `SELECT id, regulation_name, article_reference, content
     FROM regulatory_chunks
     WHERE regulation_name ILIKE $1
        OR to_tsvector('english', content) @@ plainto_tsquery('english', $2)
     ORDER BY
       -- Exact regulation name matches always rank above FTS matches
       CASE WHEN regulation_name ILIKE $1 THEN 0 ELSE 1 END,
       ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) DESC
     LIMIT $3`,
    [regulation, ftsQuery, limit]
  );
  return result.rows;
}
