/** V2 SSE event types */
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

/** V3 types */
export interface Document {
  id: string;
  display_name: string;
  status: 'processing' | 'ready' | 'error';
  file_size_bytes: number;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
}

export interface ChatCitation {
  documentName: string;
  sectionHeading: string | null;
  sectionNumber: string | null;
  pageNumber: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ChatCitation[];
  answer_status: 'answered' | 'not_found' | 'error';
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
}

export interface TrainingModuleWithProgress extends TrainingModule {
  completed_at: string | null;
}

export interface TrainingProgress {
  total: number;
  completed: number;
  byRegulation: Array<{ regulation: string; total: number; completed: number }>;
}

/** User management types */
export interface CompanyUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  role: 'admin' | 'employee';
  employeeRole: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  employeeRole: string | null;
  createdAt: number;
}

/** Chat SSE event */
export type ChatSseEvent =
  | { type: 'token'; token: string }
  | { type: 'done'; answerStatus: 'answered' | 'not_found'; citations: ChatCitation[] }
  | { type: 'error'; error: string };
