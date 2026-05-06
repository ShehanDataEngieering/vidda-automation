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

export interface Gap {
  regulation: string;
  score: number;
  severity: 'critical' | 'high' | 'medium';
  affectedRoles: string[];
}

export interface QualityResult {
  score: number;
  breakdown: Record<string, number>;
  citationGrounded: boolean;
  warnings: string[];
}

export type SseEvent =
  | { type: 'stage'; message: string }
  | { type: 'gap_found'; regulation: string; score: number; severity: string; roles: string[] }
  | { type: 'module_start'; regulation: string; role: string; moduleId: string }
  | { type: 'chunk'; content: string; moduleId: string }
  | { type: 'module_done'; moduleId: string; qualityScore: number; citationGrounded: boolean; warnings: string[] }
  | { type: 'complete'; totalModules: number }
  | { type: 'error'; message: string };
