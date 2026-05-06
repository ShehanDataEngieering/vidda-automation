/** V2 SSE event types — mirrors backend/src/types.ts */
export type SseEvent =
  | { type: 'stage'; message: string }
  | { type: 'gap_found'; regulation: string; score: number; severity: 'critical' | 'high' | 'medium'; roles: string[] }
  | { type: 'module_start'; regulation: string; role: string; moduleId: string }
  | { type: 'chunk'; content: string; moduleId: string }
  | { type: 'module_done'; moduleId: string; qualityScore: number; citationGrounded: boolean; warnings: string[] }
  | { type: 'complete'; totalModules: number }
  | { type: 'error'; message: string };

export interface TrainingModule {
  id: string;
  regulation: string;
  role: string;
  content: string | null;
  quality_score: number | null;
  quality_breakdown: Record<string, number> | null;
  citation_grounded: boolean;
  status: 'pending' | 'approved' | 'rejected';
  version: number;
  created_at: string;
}
