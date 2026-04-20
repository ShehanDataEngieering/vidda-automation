import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { companyRouter } from './routes/company';
import { generateRouter } from './routes/generate';
import { modulesRouter } from './routes/modules';

dotenv.config();

// Fail fast if required env vars are missing — avoids cryptic API errors at request time
const REQUIRED_ENV = ['DATABASE_URL', 'ANTHROPIC_API_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/company', companyRouter);
app.use('/api/generate', generateRouter);
app.use('/api/modules', modulesRouter);

app.listen(PORT, () => {
  console.log(`Vidda backend running on http://localhost:${PORT}`);
});
