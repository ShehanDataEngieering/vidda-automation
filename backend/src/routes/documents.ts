import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireSignedIn, requireRole } from '../middleware/requireAuth';
import { getUserContext } from '../utils/getUser';
import { chunkPdf } from '../services/pdfChunker';
import { embedTexts } from '../services/embeddings';
import { db as pool } from '../db/client';
import { logger } from '../utils/logger';

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

/**
 * POST /api/documents/upload
 * Admin uploads a PDF compliance document.
 */
documentsRouter.post(
  '/upload',
  requireSignedIn,
  requireRole('admin'),
  upload.single('pdf'),
  async (req: Request, res: Response) => {
    const user = getUserContext(req, res);
    if (!user) return;

    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided (field name: pdf)' });
      return;
    }

    const { originalname, size, buffer } = req.file;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO documents (company_id, uploaded_by, display_name, file_size_bytes, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [user.companyId, user.userId, originalname, size],
    );
    const documentId = rows[0].id;

    logger.info('Document upload accepted', { documentId, file: originalname, size, userId: user.userId });

    // Background chunking — respond immediately
    res.status(202).json({ documentId, status: 'processing' });

    setImmediate(async () => {
      logger.info('PDF chunking started', { documentId, file: originalname });
      try {
        const { parents, children, crossRefs } = await chunkPdf(buffer);
        logger.info('PDF chunked', { documentId, parents: parents.length, children: children.length, crossRefs: crossRefs.length });

        // Insert parent chunks first (no parent_chunk_id)
        const parentIdByIndex = new Map<number, string>();
        for (const chunk of parents) {
          const { rows: pr } = await pool.query<{ id: string }>(
            `INSERT INTO document_chunks
               (document_id, company_id, chunk_index, section_heading, section_number, page_number, content, chunk_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'parent')
             RETURNING id`,
            [documentId, user.companyId, chunk.chunkIndex, chunk.sectionHeading, chunk.sectionNumber, chunk.pageNumber, chunk.content],
          );
          parentIdByIndex.set(chunk.chunkIndex, pr[0].id);
        }

        // Insert child chunks referencing their parent UUIDs
        const childIdByIndex = new Map<number, string>();
        for (const chunk of children) {
          const parentUuid = parentIdByIndex.get(chunk.parentChunkIndex) ?? null;
          const { rows: cr } = await pool.query<{ id: string }>(
            `INSERT INTO document_chunks
               (document_id, company_id, chunk_index, section_heading, section_number, page_number, content, chunk_type, parent_chunk_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'child', $8)
             RETURNING id`,
            [documentId, user.companyId, chunk.chunkIndex, chunk.sectionHeading, chunk.sectionNumber, chunk.pageNumber, chunk.content, parentUuid],
          );
          childIdByIndex.set(chunk.chunkIndex, cr[0].id);
        }

        // Generate embeddings for parents and children, then UPDATE
        const allChunks = [...parents, ...children];
        const allTexts = allChunks.map(c => c.content);
        logger.info('Generating embeddings', { documentId, count: allTexts.length });
        const embeddings = await embedTexts(allTexts);

        for (let i = 0; i < parents.length; i++) {
          const embedding = embeddings[i];
          if (!embedding) continue;
          const uuid = parentIdByIndex.get(parents[i].chunkIndex);
          if (!uuid) continue;
          await pool.query(
            `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
            [`[${embedding.join(',')}]`, uuid],
          );
        }
        for (let i = 0; i < children.length; i++) {
          const embedding = embeddings[parents.length + i];
          if (!embedding) continue;
          const uuid = childIdByIndex.get(children[i].chunkIndex);
          if (!uuid) continue;
          await pool.query(
            `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
            [`[${embedding.join(',')}]`, uuid],
          );
        }
        logger.info('Embeddings generated', { documentId, embedded: embeddings.filter(Boolean).length });

        // Build cross-reference relationships (source = parent chunks)
        if (crossRefs.length > 0) {
          const { rows: sectionRows } = await pool.query<{ id: string; section_number: string }>(
            `SELECT id, section_number FROM document_chunks WHERE document_id = $1 AND section_number IS NOT NULL`,
            [documentId],
          );
          const idBySection = new Map(sectionRows.map(r => [r.section_number.toLowerCase(), r.id]));

          for (const ref of crossRefs) {
            const sourceId = parentIdByIndex.get(ref.sourceChunkIndex);
            const targetId = idBySection.get(ref.targetSectionNumber);
            if (sourceId && targetId) {
              await pool.query(
                `INSERT INTO chunk_relationships (source_chunk_id, target_chunk_id, relationship)
                 VALUES ($1, $2, 'references')
                 ON CONFLICT (source_chunk_id, target_chunk_id, relationship) DO NOTHING`,
                [sourceId, targetId],
              );
            }
          }
        }

        const totalChunks = parents.length + children.length;
        await pool.query(
          `UPDATE documents SET status = 'ready', total_chunks = $1 WHERE id = $2`,
          [totalChunks, documentId],
        );
        logger.info('Document ready', { documentId, parents: parents.length, children: children.length });
      } catch (err) {
        logger.error('PDF chunking failed', { documentId, error: String(err) });
        await pool.query(
          `UPDATE documents SET status = 'error', error_message = $1 WHERE id = $2`,
          [String(err), documentId],
        );
      }
    });
  },
);

/**
 * GET /api/documents
 * List all documents for the admin's company.
 */
documentsRouter.get('/', requireSignedIn, requireRole('admin'), async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT id, display_name, status, file_size_bytes, total_chunks, error_message, created_at
     FROM documents
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [user.companyId],
  );
  res.json(rows);
});

/**
 * GET /api/documents/:id/status
 * Poll chunking status for a single document.
 */
documentsRouter.get('/:id/status', requireSignedIn, requireRole('admin'), async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT status, total_chunks, error_message FROM documents WHERE id = $1 AND company_id = $2`,
    [req.params.id, user.companyId],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(rows[0]);
});

/**
 * DELETE /api/documents/:id
 * Delete a document and all its chunks (cascades via FK).
 */
documentsRouter.delete('/:id', requireSignedIn, requireRole('admin'), async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rowCount } = await pool.query(
    `DELETE FROM documents WHERE id = $1 AND company_id = $2`,
    [req.params.id, user.companyId],
  );
  if (!rowCount) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ ok: true });
});
