-- V6: AMLR Pipeline — training plans + audit events + assignments
-- Branch: feat/pipeline-foundation

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
