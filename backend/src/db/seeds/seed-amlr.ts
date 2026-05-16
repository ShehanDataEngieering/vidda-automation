import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../db/client';
import { chunkPdf } from '../../services/pdf/chunker';
import { embedTexts } from '../../services/rag/embeddings';
import { logger } from '../../utils/logger';

// ===========================================================================
// Seed AMLR 2024/1624 Articles 9-15 into regulatory_chunks
// 
// Source: EUR-Lex PDF from https://eur-lex.europa.eu/eli/reg/2024/1624/oj
// The PDF must be manually downloaded and placed in seeds/data/amlr-2024-1624.pdf
// 
// This gives the RAG pipeline real regulation text to retrieve when the AI
// maps articles during Step 4 (AMLR Article Mapping).
//
// Usage: npm run seed:amlr   (add this script to package.json)
// ===========================================================================

const PDF_PATH = path.join(__dirname, 'data', 'amlr-2024-1624.pdf');

// AMLR 2024/1624 articles relevant to training obligations
const TARGET_ARTICLES = ['9', '10', '11', '12', '13', '14', '15'];

async function main() {
  logger.info('Seeding AMLR 2024/1624 Articles 9-15...');

  // Idempotency check — skip if already seeded (can re-run safely)
  const { rows: existing } = await db.query(
    `SELECT COUNT(*) as cnt FROM regulatory_chunks WHERE regulation = 'AMLR'`,
  );
  if (existing[0]?.cnt > 0) {
    logger.info(`AMLR already seeded (${existing[0].cnt} chunks). Skipping. To re-seed: DELETE FROM regulatory_chunks WHERE regulation = 'AMLR';`);
    return;
  }

  // Phase 1: Extract article text from the PDF (if available)
  let chunks: Array<{ content: string; sectionNumber: string; sectionHeading: string | null; pageNumber: number | null }> = [];

  if (fs.existsSync(PDF_PATH)) {
    logger.info('Reading AMLR PDF...');
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    const result = await chunkPdf(pdfBuffer);

    // Collect all parent + child chunks that match target articles
    for (const p of result.parents) {
      if (p.sectionNumber) {
        const num = p.sectionNumber.replace(/[^0-9]/g, '');
        if (TARGET_ARTICLES.includes(num)) {
          chunks.push({
            content: p.content,
            sectionNumber: p.sectionNumber,
            sectionHeading: p.sectionHeading,
            pageNumber: p.pageNumber,
          });
        }
      }
    }
    for (const c of result.children) {
      if (c.sectionNumber) {
        const num = c.sectionNumber.replace(/[^0-9]/g, '');
        if (TARGET_ARTICLES.includes(num)) {
          chunks.push({
            content: c.content,
            sectionNumber: c.sectionNumber,
            sectionHeading: c.sectionHeading,
            pageNumber: c.pageNumber,
          });
        }
      }
    }
  }

  // Phase 2: Fallback — hardcoded stubs if PDF absent or parsing failed
  // This ensures the pipeline can still run (with reduced accuracy) during development
  if (chunks.length === 0) {
    logger.warn('PDF not found or produced no article chunks. Using hardcoded stubs.');
    chunks = TARGET_ARTICLES.map(num => ({
      content: `Article ${num} of AMLR 2024/1624. [Full regulatory text to be loaded from EUR-Lex PDF.]`,
      sectionNumber: num,
      sectionHeading: `Article ${num}`,
      pageNumber: null,
    }));
  }

  logger.info(`Collected ${chunks.length} AMLR article chunks. Embedding...`);

  const texts = chunks.map(c => c.content);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    const emb = embeddings[i];
    if (!emb || emb.length === 0) continue;

    await db.query(
      `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, content, embedding)
       VALUES ('AMLR', $1, $2, $3, $4::vector)
       ON CONFLICT (regulation, article_number) DO UPDATE
       SET content = $3, embedding = $4::vector`,
      [c.sectionNumber, `AMLR Article ${c.sectionNumber}`, c.content, `[${emb.join(',')}]`],
    );
  }

  // Verify
  const { rows: verify } = await db.query(
    `SELECT article_number, LEFT(content, 80) as preview FROM regulatory_chunks WHERE regulation = 'AMLR' ORDER BY article_number`,
  );

  logger.info(`AMLR seed complete. ${verify.length} articles loaded:`);
  for (const r of verify) {
    logger.info(`  Article ${r.article_number}: ${r.preview}`);
  }
}

main().catch(err => {
  logger.error('AMLR seed failed', { error: String(err) });
  process.exit(1);
});
