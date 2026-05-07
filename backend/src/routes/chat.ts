import { Router, Request, Response } from 'express';
import { requireSignedIn, requireRole } from '../middleware/auth';
import { getUserContext } from '../utils/user';
import { searchDocumentChunks } from '../services/rag/documentSearch';
import { streamChatAnswer, buildCitations, detectAnswerStatus } from '../services/llm/chatGeneration';
import { db as pool } from '../db/client';
import { logger } from '../utils/logger';

export const chatRouter = Router();

// All chat routes require an employee session
chatRouter.use(requireSignedIn, requireRole('employee'));

async function streamAnswer(
  req: Request,
  res: Response,
  sessionId: string,
  question: string,
  companyId: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<void> {
  // Persist the user message
  await pool.query(
    `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
    [sessionId, question],
  );

  // Retrieve relevant chunks
  logger.info('Chat search', { sessionId, chunks: 0, question: question.slice(0, 80) });
  const chunks = await searchDocumentChunks(question, companyId);
  logger.info('Chunks retrieved', { sessionId, count: chunks.length });
  const citations = buildCitations(chunks);

  // Open SSE stream
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  logger.info('Chat stream started', { sessionId });
  let fullText = '';
  try {
    for await (const token of streamChatAnswer(question, chunks, history)) {
      fullText += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }

    const answerStatus = detectAnswerStatus(fullText);

    // Persist assistant message
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, citations, answer_status)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [sessionId, fullText, JSON.stringify(citations), answerStatus],
    );

    logger.info('Chat stream done', { sessionId, answerStatus, tokens: fullText.length });
    res.write(
      `data: ${JSON.stringify({ type: 'done', answerStatus, citations })}\n\n`,
    );
  } catch (err) {
    logger.error('Chat stream error', { sessionId, error: String(err) });
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, answer_status)
       VALUES ($1, 'assistant', $2, 'error')`,
      [sessionId, 'An error occurred while generating the answer.'],
    );
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * POST /api/chat/sessions
 * Start a new session and stream the first answer.
 */
chatRouter.post('/sessions', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const question: string = req.body?.question?.trim?.() ?? '';
  if (!question) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  // Session title = first 80 chars of the question
  const title = question.slice(0, 80);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO chat_sessions (user_id, company_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [user.userId, user.companyId, title],
  );
  const sessionId = rows[0].id;

  await streamAnswer(req, res, sessionId, question, user.companyId, []);
});

/**
 * GET /api/chat/sessions
 * List all sessions for the current user.
 */
chatRouter.get('/sessions', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const { rows } = await pool.query(
    `SELECT id, title, created_at FROM chat_sessions
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.userId],
  );
  res.json(rows);
});

/**
 * GET /api/chat/sessions/:id/messages
 * Fetch all messages for a session.
 */
chatRouter.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  // Verify the session belongs to this user
  const { rows: session } = await pool.query(
    `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [req.params.id, user.userId],
  );
  if (!session[0]) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, role, content, citations, answer_status, created_at
     FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [req.params.id],
  );
  res.json(rows);
});

/**
 * POST /api/chat/sessions/:id/messages
 * Continue an existing session — streams an answer.
 */
chatRouter.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  const user = getUserContext(req, res);
  if (!user) return;

  const question: string = req.body?.question?.trim?.() ?? '';
  if (!question) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  // Verify ownership
  const { rows: session } = await pool.query(
    `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
    [req.params.id, user.userId],
  );
  if (!session[0]) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Load last 10 messages as history context
  const { rows: historyRows } = await pool.query<{ role: 'user' | 'assistant'; content: string }>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [req.params.id],
  );
  const history = historyRows.reverse();

  await streamAnswer(req, res, req.params.id, question, user.companyId, history);
});
