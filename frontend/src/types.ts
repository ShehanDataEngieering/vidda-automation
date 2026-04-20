/**
 * SseEvent mirrors the discriminated union in backend/src/types.ts.
 * Kept in sync manually — in Week 2 extract to a shared package.
 */
export type SseEvent =
  | { type: 'stage'; message: string }
  | { type: 'gap_found'; regulation: string; score: number; roles: string[] }
  | { type: 'module_start'; regulation: string; role: string; moduleId: string }
  | { type: 'chunk'; content: string; moduleId: string }
  | { type: 'module_done'; moduleId: string; qualityScore: number }
  | { type: 'done' }
  | { type: 'error'; message: string };
