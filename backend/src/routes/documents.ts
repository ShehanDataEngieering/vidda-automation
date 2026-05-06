import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireSignedIn, requireRole } from '../middleware/requireAuth';
import { getUserContext } from '../utils/getUser';
import { chunkPdf } from '../services/pdfChunker';
import { db as pool } from '../db/client';

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

    // Background chunking — respond immediately
    res.status(202).json({ documentId, status: 'processing' });

    setImmediate(async () => {
      try {
        const { chunks, crossRefs } = await chunkPdf(buffer);

        // Batch insert chunks
        for (const chunk of chunks) {
          await pool.query(
            `INSERT INTO document_chunks
               (document_id, company_id, chunk_index, section_heading, section_number, page_number, content)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              documentId,
              user.companyId,
              chunk.chunkIndex,
              chunk.sectionHeading,
              chunk.sectionNumber,
              chunk.pageNumber,
              chunk.content,
            ],
          );
        }

        // Build cross-reference relationships
        if (crossRefs.length > 0) {
          // Fetch all chunk IDs for this document (indexed by chunkIndex)
          const { rows: chunkRows } = await pool.query<{ id: string; chunk_index: number }>(
            `SELECT id, chunk_index FROM document_chunks WHERE document_id = $1`,
            [documentId],
          );
          const idByIndex = new Map(chunkRows.map(r => [r.chunk_index, r.id]));

          // Fetch target chunks by section_number within this document
          const { rows: sectionRows } = await pool.query<{ id: string; section_number: string }>(
            `SELECT id, section_number FROM document_chunks WHERE document_id = $1 AND section_number IS NOT NULL`,
            [documentId],
          );
          const idBySection = new Map(sectionRows.map(r => [r.section_number.toLowerCase(), r.id]));

          for (const ref of crossRefs) {
            const sourceId = idByIndex.get(ref.sourceChunkIndex);
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

        await pool.query(
          `UPDATE documents SET status = 'ready', total_chunks = $1 WHERE id = $2`,
          [chunks.length, documentId],
        );
      } catch (err) {
        console.error('PDF chunking error:', err);
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
