-- V4 Migration: Voyage AI embeddings (1024 dims), parent-child chunking, HNSW indexes
-- Safe to run multiple times

-- 1. Resize embedding columns from 1536 → 1024 (all rows are NULL, safe to drop+re-add)
ALTER TABLE regulatory_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE regulatory_chunks ADD COLUMN embedding vector(1024);

ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE document_chunks ADD COLUMN embedding vector(1024);

-- 2. Parent-child columns on document_chunks
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS parent_chunk_id UUID
    REFERENCES document_chunks(id) ON DELETE SET NULL;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS chunk_type VARCHAR(10)
    CHECK (chunk_type IN ('parent', 'child')) DEFAULT 'child';

UPDATE document_chunks SET chunk_type = 'child' WHERE chunk_type IS NULL;

-- 3. HNSW indexes (builds incrementally, no minimum row count needed)
DROP INDEX IF EXISTS idx_chunks_vector;
CREATE INDEX IF NOT EXISTS idx_reg_chunks_vector
  ON regulatory_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_vector
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_parent
  ON document_chunks(parent_chunk_id) WHERE parent_chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_chunks_type
  ON document_chunks(company_id, chunk_type);
