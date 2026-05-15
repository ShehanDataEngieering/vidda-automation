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
  embedding vector(1024),
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
  rationale TEXT,
  risk_dimensions JSONB,
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

-- IVFFlat index for pgvector vector search
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON regulatory_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- =============================================================================
-- V3: PDF Document Upload
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by     VARCHAR(255),
  display_name    VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT,
  status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'ready', 'error')),
  error_message   TEXT,
  total_chunks    INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id, status);

CREATE TABLE IF NOT EXISTS document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  section_heading VARCHAR(500),
  section_number  VARCHAR(50),
  page_number     INTEGER,
  content         TEXT NOT NULL,
  embedding       vector(1024),
  chunk_type      VARCHAR(20) DEFAULT 'child',
  parent_chunk_id UUID REFERENCES document_chunks(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_company ON document_chunks(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_type ON document_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_parent ON document_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_fts ON document_chunks
  USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_doc_chunks_vector ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE TABLE IF NOT EXISTS chunk_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  target_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  relationship    VARCHAR(50) CHECK (relationship IN ('references','amends','defines','see_also')),
  UNIQUE (source_chunk_id, target_chunk_id, relationship)
);

-- =============================================================================
-- V3: Employee Compliance Chat
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(255) NOT NULL,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  title       VARCHAR(500),
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  citations     JSONB DEFAULT '[]',
  answer_status VARCHAR(20) DEFAULT 'answered'
                  CHECK (answer_status IN ('answered', 'not_found', 'error')),
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- =============================================================================
-- V3: Employee Training Dashboard
-- =============================================================================

CREATE TABLE IF NOT EXISTS module_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      VARCHAR(255) NOT NULL,
  module_id    UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_completions_user ON module_completions(user_id);

-- =============================================================================
-- V5: Interactive Course Player
-- =============================================================================

CREATE TABLE IF NOT EXISTS module_quizzes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  questions  JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (module_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  user_id    VARCHAR(255) NOT NULL,
  answers    JSONB NOT NULL,
  score      INTEGER NOT NULL,
  passed     BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
