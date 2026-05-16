// ===========================================================================
// V6 — Pipeline types (AMLR hackathon)
// ===========================================================================

export interface RiskDimensionScore {
  dimension: string;
  score: 'Low' | 'Medium' | 'High' | 'Critical';
  justification: string;
}

export interface AMLRMapping {
  article: string;
  article_name: string;
  applies_because: string;
  training_obligation: string;
}

export interface TrainingModulePlan {
  module_name: string;
  duration_hours: number;
  risk_dimension: string;
  amlr_article: string;
  why_included: string;
}

export interface Quarter {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  name: string;
  months: string;
  modules: TrainingModulePlan[];
}

export interface TrainingPlan {
  role_title: string;
  training_philosophy: string;
  quarters: Quarter[];
}

export interface RoleProfileV6 {
  role_title: string;
  line_of_defence: '1LoD' | '2LoD';
  classified_as: string;
  classification_confidence: number;
  daily_activities: string;
  key_decisions: string;
  mistake_consequences: string;
}

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

export interface PlanAssignment {
  id: string;
  plan_id: string;
  user_id: string;
  module_index: number;
  quarter: string;
  due_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  completed_at: string | null;
}

export type PipelineSseEvent =
  | { type: 'token'; token: string }
  | { type: 'done'; plan: TrainingPlan }
  | { type: 'error'; message: string };
