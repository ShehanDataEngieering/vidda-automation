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
