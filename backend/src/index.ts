import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { companyRouter } from './routes/company';
import { generateRouter } from './routes/generate';
import { modulesRouter } from './routes/modules';

dotenv.config();

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
