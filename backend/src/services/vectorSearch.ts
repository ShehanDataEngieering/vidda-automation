import { db } from '../db/client';
import type { SearchResult } from '../types';

const ROLE_KEYWORDS: Record<string, string[]> = {
  'Compliance Officer': ['compliance', 'AML', 'responsibility', 'obligation', 'reporting'],
  'Front Office': ['customer', 'transaction', 'investment', 'advice', 'suitability'],
  'Onboarding Team': ['CDD', 'identity', 'verification', 'due diligence', 'customer'],
  'IT Team': ['ICT', 'security', 'technical', 'encryption', 'resilience'],
  'Risk Officer': ['risk', 'assessment', 'enhanced', 'high-risk', 'monitoring'],
  'Senior Management': ['senior', 'approval', 'oversight', 'governance', 'management'],
  'Customer Service': ['customer', 'request', 'erasure', 'data', 'rights'],
  'HR Department': ['employee', 'training', 'staff', 'personnel'],
  'All Staff': ['training', 'compliance', 'regulation', 'policy'],
};

function getRoleKeywords(role: string): string[] {
  return ROLE_KEYWORDS[role] ?? ['compliance', 'regulation'];
}

function rerankChunks(chunks: any[], regulation: string, role: string): SearchResult[] {
  return chunks
    .map(chunk => {
      let finalScore: number = Number(chunk.bm25_score) || 0;

      if ((chunk.article_reference as string).toLowerCase().includes(regulation.toLowerCase())) {
        finalScore += 0.3;
      }

      const roleKws = getRoleKeywords(role);
      const entities: string[] = Array.isArray(chunk.entities) ? chunk.entities : [];
      const entityMatches = entities.filter((e: string) =>
        roleKws.some(k => e.toLowerCase().includes(k.toLowerCase()))
      ).length;
      finalScore += entityMatches * 0.1;

      const contentLower = (chunk.content as string).toLowerCase();
      if (contentLower.includes('training') || contentLower.includes('competence')) {
        finalScore += 0.15;
      }

      return {
        id: String(chunk.id),
        regulation: String(chunk.regulation),
        article_number: String(chunk.article_number ?? ''),
        article_reference: String(chunk.article_reference),
        entities,
        content: String(chunk.content),
        bm25Score: Number(chunk.bm25_score) || 0,
        finalScore,
      } satisfies SearchResult;
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

export async function searchChunks(
  regulation: string,
  role: string,
  topK = 5
): Promise<SearchResult[]> {
  const searchTerm = `${regulation} compliance ${role}`;

  const result = await db.query(
    `SELECT
       id, regulation, article_number, article_reference, entities, content,
       ts_rank(
         to_tsvector('english', content || ' ' || COALESCE(array_to_string(entities, ' '), '')),
         plainto_tsquery('english', $1)
       ) AS bm25_score
     FROM regulatory_chunks
     WHERE regulation = $2
       AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
     ORDER BY bm25_score DESC
     LIMIT 10`,
    [searchTerm, regulation]
  );

  if (result.rows.length === 0) {
    // Fallback: return all chunks for this regulation if FTS returns nothing
    const fallback = await db.query(
      `SELECT id, regulation, article_number, article_reference, entities, content, 0.1 AS bm25_score
       FROM regulatory_chunks WHERE regulation = $1 LIMIT 10`,
      [regulation]
    );
    return rerankChunks(fallback.rows, regulation, role).slice(0, topK);
  }

  return rerankChunks(result.rows, regulation, role).slice(0, topK);
}
