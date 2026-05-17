import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { clerkMiddleware, resolveAuthUser } from './middleware/auth';
import { companyRouter } from './routes/company';
import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';
import { trainingRouter } from './routes/training';
import { usersRouter } from './routes/users';
import { pipelineRouter } from './routes/pipeline';
import { logger } from './utils/logger';

dotenv.config();

const REQUIRED_ENV = ['DATABASE_URL', 'OPENROUTER_API_KEY', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY', 'VOYAGE_API_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// HTTP request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Health check before Clerk
app.get('/health', (_req, res) => {
  logger.debug('Health check');
  res.json({ ok: true });
});

// Clerk session parsing
app.use(clerkMiddleware());

// Resolve user metadata — fills req.resolvedUser from JWT claims or Clerk API fallback
app.use(resolveAuthUser);

// Resolve user metadata — fills req.resolvedUser from JWT claims or Clerk API fallback
app.use(resolveAuthUser);

// Routes
app.use('/api/company', companyRouter);
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/training', trainingRouter);
app.use('/api/users', usersRouter);
app.use('/api/pipeline', pipelineRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Vidda backend started`, { port: PORT, env: process.env.NODE_ENV ?? 'development' });
  logger.info('Routes mounted', {
    routes: ['/health', '/api/company', '/api/auth', '/api/documents', '/api/training', '/api/users', '/api/pipeline'],
  });
});
