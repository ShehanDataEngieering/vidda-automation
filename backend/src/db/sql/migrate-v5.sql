-- V5: Fix embedding dimension, add IVFFlat indexes, add chunk_type + parent_chunk_id columns

-- Fix regulatory_chunks embedding dimension (1536 → 1024 for voyage-finance-2)
ALTER TABLE regulatory_chunks ALTER COLUMN embedding TYPE vector(1024);

-- Fix document_chunks embedding dimension
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024);

-- Add missing chunk_type + parent_chunk_id columns to document_chunks
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS chunk_type VARCHAR(20) DEFAULT 'child';
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES document_chunks(id);

-- Add chunk_type + parent_chunk_id indexes
CREATE INDEX IF NOT EXISTS idx_doc_chunks_type ON document_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_parent ON document_chunks(parent_chunk_id);

-- Activate IVFFlat indexes for vector search
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON regulatory_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_vector ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
