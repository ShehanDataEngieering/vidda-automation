-- Enable pgvector extension for semantic search (used in Week 2)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  industry    TEXT NOT NULL,
  regulations TEXT[] NOT NULL, -- all regulations the company selected during onboarding
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  regulation   TEXT NOT NULL,
  score        INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  -- One score per regulation per company; upserted on re-submission
  UNIQUE (company_id, regulation)
);

CREATE TABLE IF NOT EXISTS training_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  regulation    TEXT NOT NULL,
  role          TEXT NOT NULL,  -- the affected role this module targets
  content       TEXT,           -- NULL until generation completes
  quality_score INTEGER,        -- 0–100, populated after generation
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  reviewer    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  reason      TEXT,             -- populated on rejection to drive regeneration
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- regulatory_chunks stores source regulatory text used to ground generation.
-- embedding column is 1536-dim to match OpenAI text-embedding-3-small (Week 2).
-- In Week 1 it remains NULL and full-text search is used instead.
CREATE TABLE IF NOT EXISTS regulatory_chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_name   TEXT NOT NULL,
  article_reference TEXT NOT NULL,
  content           TEXT NOT NULL,
  embedding         vector(1536),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index enables efficient full-text search in Week 1
CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON regulatory_chunks USING gin(to_tsvector('english', content));

-- Uncomment in Week 2 after populating embeddings via the embedding script:
-- CREATE INDEX ON regulatory_chunks USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
