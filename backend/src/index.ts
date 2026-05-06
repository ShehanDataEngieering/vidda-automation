import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkMiddleware } from './middleware/requireAuth';
import { companyRouter } from './routes/company';
import { generateRouter } from './routes/generate';
import { modulesRouter } from './routes/modules';
import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';
import { chatRouter } from './routes/chat';
import { trainingRouter } from './routes/trainingDashboard';

dotenv.config();

const REQUIRED_ENV = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Health check before Clerk — no auth needed
app.get('/health', (_req, res) => res.json({ ok: true }));

// Clerk session parsing on every request (does not block unauthenticated requests)
app.use(clerkMiddleware());

// V2 admin pipeline — unchanged
app.use('/api/company', companyRouter);
app.use('/api/generate', generateRouter);
app.use('/api/modules', modulesRouter);

// V3 new routes
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/training', trainingRouter);

app.listen(PORT, () => {
  console.log(`Vidda backend running on http://localhost:${PORT}`);
});
