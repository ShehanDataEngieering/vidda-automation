/**
 * Shared domain types for the Vidda Automation API — V2.
 */

// ---------------------------------------------------------------------------
// Service types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  regulation: string;
  article_number: string;
  article_reference: string;
  entities: string[];
  content: string;
  bm25Score: number;
  finalScore: number;
}

export interface RiskDimensions {
  aml: 'high' | 'medium' | 'low' | 'none';
  sanctions: 'high' | 'medium' | 'low' | 'none';
  fraud: 'high' | 'medium' | 'low' | 'none';
  documentation: 'high' | 'medium' | 'low' | 'none';
}

export interface RoleProfile {
  title: string;
  description: string;
  riskDimensions: RiskDimensions;
  regulatoryArticles: string[];
}

export interface Gap {
  regulation: string;
  score: number;
  severity: 'critical' | 'high' | 'medium';
  affectedRoles: string[];
  rationale: string;
  roleProfiles: Record<string, RoleProfile>;
}

export interface QualityResult {
  score: number;
  breakdown: Record<string, number>;
  citationGrounded: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// SSE events — V2
// ---------------------------------------------------------------------------

export type SseEvent =
  | { type: 'stage'; message: string }
  | { type: 'gap_found'; regulation: string; score: number; severity: string; roles: string[] }
  | { type: 'module_start'; regulation: string; role: string; moduleId: string }
  | { type: 'chunk'; content: string; moduleId: string }
  | { type: 'module_done'; moduleId: string; qualityScore: number; citationGrounded: boolean; warnings: string[] }
  | { type: 'complete'; totalModules: number }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// API request/response bodies
// ---------------------------------------------------------------------------

export interface CreateCompanyBody {
  name: string;
  industry: string;
  size?: string;
  regulations: Record<string, number>;
}

export interface GenerateBody {
  companyId: string;
}

export interface PatchModuleBody {
  action: 'approved' | 'rejected';
  reviewer?: string;
  comment?: string;
}

export interface RegenerateBody {
  reason?: string;
}

export interface TrainingModule {
  id: string;
  company_id: string;
  regulation: string;
  role: string;
  content: string | null;
  quality_score: number | null;
  quality_breakdown: Record<string, number> | null;
  citation_grounded: boolean;
  status: 'pending' | 'approved' | 'rejected';
  version: number;
  rationale: string | null;
  risk_dimensions: RiskDimensions | null;
  created_at: string;
  updated_at: string;
}

// ===========================================================================
// V6 — Pipeline types (AMLR hackathon)
// These map exactly to the JSON schemas defined in vidda_AI_context_brief.md
// ===========================================================================

// One dimension of the 5-dimension risk assessment (AML, Sanctions, Fraud, Documentation, Escalation)
export interface RiskDimensionScore {
  dimension: string;                              // "AML Risk" | "Sanctions Risk" | ...
  score: 'Low' | 'Medium' | 'High' | 'Critical'; // Brief scale — not 0-100
  justification: string;                          // One-sentence explanation why
}

// Maps an AMLR article to training obligations for a specific role
export interface AMLRMapping {
  article: string;              // "Article 9", "Article 12", etc.
  article_name: string;         // Official AMLR article title
  applies_because: string;      // Why this article applies to this role specifically
  training_obligation: string;  // What the role must be trained on due to this article
}

// A single training module in the quarterly plan — plans training, does NOT write content
export interface TrainingModulePlan {
  module_name: string;       // Module title
  duration_hours: number;    // Estimated hours to complete
  risk_dimension: string;    // Which risk dimension this module addresses
  amlr_article: string;      // Which AMLR article mandates this module
  why_included: string;      // THE explainability field — why assigned to this role
}

// One of four quarters in the annual training plan
export interface Quarter {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  name: string;                    // "Foundation" | "Application" | "Deepening" | "Embedding"
  months: string;                  // "Months 1-3", "Months 4-6", etc.
  modules: TrainingModulePlan[];  // 5-7 modules per quarter
}

// Complete 4-quarter training plan output
export interface TrainingPlan {
  role_title: string;
  training_philosophy: string;  // "Year 1 builds foundation..." narrative
  quarters: Quarter[];
}

// Output of Step 2 (Role Analysis) — AI extracts + classifies role
export interface RoleProfileV6 {
  role_title: string;
  line_of_defence: '1LoD' | '2LoD';
  classified_as: string;              // Best match: "KYC Analyst", "MLRO", etc.
  classification_confidence: number;  // 0-1 confidence score
  daily_activities: string;
  key_decisions: string;
  mistake_consequences: string;       // What happens if they fail
}

// Main database row — carries entire pipeline state (JSONB columns for each step)
export interface PipelinePlan {
  id: string;
  company_id: string;
  created_by: string;
  role_title: string | null;
  role_description: string | null;
  line_of_defence: string | null;
  role_profile: RoleProfileV6 | null;
  risk_matrix: RiskDimensionScore[] | null;
  amlr_mappings: AMLRMapping[] | null;
  training_plan: TrainingPlan | null;
  current_step: string;
  version: number;
  status: 'draft' | 'approved';
  reviewer: string | null;
  created_at: string;
  updated_at: string;
}

// Audit trail — one row per human or AI action on a plan
export interface PlanEvent {
  id: string;
  plan_id: string;
  version: number;              // Which version of the plan this event belongs to
  step: string;                 // "role" | "risk" | "amlr" | "plan"
  action: string;               // "ai_generated" | "human_override" | "approved" | "regenerated"
  reviewer: string | null;      // Who acted (null = AI)
  before_state: unknown | null; // State BEFORE this action (for audit trail)
  after_state: unknown | null;  // State AFTER this action
  note: string | null;          // Optional human note explaining override
  created_at: string;
}

// LMS assignment — a plan + user = assignment with due date and 3-state status
export interface PlanAssignment {
  id: string;
  plan_id: string;
  user_id: string;
  module_index: number;         // Which module in the plan (index into quarter.modules[])
  quarter: string;              // "Q1" | "Q2" | "Q3" | "Q4"
  due_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed';  // Brief requires 3 states
  completed_at: string | null;
}

// SSE streaming event type for Step 5 (Training Plan generation)
export type PipelineSseEvent =
  | { type: 'token'; token: string }
  | { type: 'done'; plan: TrainingPlan }
  | { type: 'error'; message: string };
