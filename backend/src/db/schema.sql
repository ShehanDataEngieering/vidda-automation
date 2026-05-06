CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  size VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  regulation VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  UNIQUE(company_id, regulation)
);

-- Article-boundary chunks with structured metadata
CREATE TABLE IF NOT EXISTS regulatory_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation VARCHAR(50) NOT NULL,
  article_number VARCHAR(20),
  article_reference VARCHAR(150),
  entities TEXT[] DEFAULT '{}',
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (regulation, article_number)
);

CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  regulation VARCHAR(50) NOT NULL,
  role VARCHAR(100) NOT NULL,
  content TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  quality_score INTEGER DEFAULT 0,
  quality_breakdown JSONB,
  citation_grounded BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL
    CHECK (action IN ('approved', 'rejected', 'edited', 'regenerated')),
  reviewer VARCHAR(100) DEFAULT 'Compliance Officer',
  comment TEXT,
  previous_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- GIN index for FTS on content (entities searched at query time — 15 rows, no perf issue)
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON regulatory_chunks
  USING GIN (to_tsvector('english', content));

-- IVFFlat index for pgvector (Week 2)
-- CREATE INDEX idx_chunks_vector ON regulatory_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
