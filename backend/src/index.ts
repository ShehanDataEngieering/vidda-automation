import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { clerkMiddleware, resolveAuthUser } from './middleware/auth';
import { authRouter } from './routes/auth';
import { companiesRouter } from './routes/companies';
import { documentsRouter, reconcileStaleDocuments } from './routes/documents';
import { trainingRouter } from './routes/training';
import { usersRouter } from './routes/users';
import { pipelineRouter } from './routes/pipeline';
import { logger } from './utils/logger';

dotenv.config();

const REQUIRED_ENV = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY', 'VOYAGE_API_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const PORT = process.env.PORT ?? 3001;

// Comma-separated list of allowed frontend origins, e.g. "https://vidda.app,http://localhost:5173"
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o) => o.trim());

app.use(helmet({
  // Some environments embed the frontend in an iframe on the same origin.
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// HTTP request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Health check before Clerk
app.get('/health', (_req, res) => {
  logger.debug('Health check');
  res.json({ ok: true });
});

// Rate-limit the AI-calling pipeline routes specifically — cheap to hit, expensive to serve
const pipelineLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/pipeline', pipelineLimiter);

// Clerk session parsing
app.use(clerkMiddleware());

// Resolve user metadata
app.use(resolveAuthUser);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/training', trainingRouter);
app.use('/api/users', usersRouter);
app.use('/api/pipeline', pipelineRouter);

// 404 — no route matched
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Vidda backend started`, { port: PORT, env: process.env.NODE_ENV ?? 'development' });
  logger.info('Routes mounted', {
    routes: ['/health', '/api/auth', '/api/companies', '/api/documents', '/api/training', '/api/users', '/api/pipeline'],
  });
  reconcileStaleDocuments().catch((err) => logger.error('Failed to reconcile stale documents', { error: String(err) }));
});
