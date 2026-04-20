/**
 * Shared domain types for the Vidda Automation API.
 *
 * Discriminated unions are used throughout so the compiler can narrow event
 * shapes at the call site without manual type assertions.
 */

// ---------------------------------------------------------------------------
// SSE events — streamed from POST /api/generate and POST /api/modules/:id/regenerate
// ---------------------------------------------------------------------------

export type SseEvent =
  | { type: 'stage'; message: string }
  | { type: 'gap_found'; regulation: string; score: number; roles: string[] }
  | { type: 'module_start'; regulation: string; role: string; moduleId: string }
  | { type: 'chunk'; content: string; moduleId: string }
  | { type: 'module_done'; moduleId: string; qualityScore: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// API request bodies
// ---------------------------------------------------------------------------

export interface CreateCompanyBody {
  name: string;
  industry: string;
  regulations: string[];
  /** Score per regulation key, 0–100 */
  scores: Record<string, number>;
}

export interface GenerateBody {
  companyId: string;
}

export interface PatchModuleBody {
  status: 'approved' | 'rejected';
  reviewer: string;
  reason?: string;
}

export interface RegenerateBody {
  reason?: string;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface CreateCompanyResponse {
  companyId: string;
}

export interface TrainingModule {
  id: string;
  company_id: string;
  regulation: string;
  role: string;
  content: string | null;
  quality_score: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}
