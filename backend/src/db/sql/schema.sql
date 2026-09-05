CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  size VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
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
-- V6: AMLR Pipeline — training plans + audit events + assignments
-- (previously only in migrate-v6.sql; folded in here so a fresh database
--  actually gets the tables the current pipeline depends on)
-- =============================================================================

CREATE TABLE IF NOT EXISTS training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  role_title VARCHAR(200),
  role_description TEXT,
  line_of_defence VARCHAR(10),
  role_profile JSONB,
  risk_matrix JSONB,
  amlr_mappings JSONB,
  training_plan JSONB,
  quality_score INTEGER,
  quality_breakdown JSONB,
  current_step VARCHAR(20) DEFAULT 'role',
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved')),
  reviewer VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_plans_company ON training_plans(company_id, status);

CREATE TABLE IF NOT EXISTS plan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  step VARCHAR(20) NOT NULL,
  action VARCHAR(30) NOT NULL
    CHECK (action IN ('ai_generated', 'human_override', 'approved', 'regenerated')),
  reviewer VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_events_plan ON plan_events(plan_id, version);

CREATE TABLE IF NOT EXISTS plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  module_index INTEGER NOT NULL,
  quarter VARCHAR(4) NOT NULL,
  due_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at TIMESTAMP,
  UNIQUE (plan_id, user_id, module_index, quarter)
);

CREATE INDEX IF NOT EXISTS idx_plan_assignments_user ON plan_assignments(user_id, status);
