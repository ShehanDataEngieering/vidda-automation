# Vidda Automation

AI-powered compliance training generation. Identifies regulatory gaps from governance scores, maps gaps to affected roles, streams Claude-generated training modules grounded in regulatory text.

## Stack

- **Backend**: Node.js 20 + TypeScript + Express + pg
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: Supabase (hosted PostgreSQL with pgvector)
- **AI**: Anthropic Claude (`claude-sonnet-4-6`) via SSE streaming
- **Tests**: Jest + ts-jest (26 tests, 4 services, TDD red→green)

## Prerequisites

- WSL 2 (Ubuntu 24.04)
- Node.js 20 (`node --version` to verify)
- Supabase account (free tier) — supabase.com
- Anthropic API key — console.anthropic.com

## 1 — Supabase setup (~5 min)

1. Create a new project at supabase.com
2. Go to **Settings → Database → Connection string → URI**
3. Copy the connection string (it starts with `postgresql://postgres:...`)
4. Open the **SQL Editor** in Supabase and paste + run the contents of `backend/src/db/schema.sql`

## 2 — Backend setup

```bash
cd ~/vidda-automation/backend

# Create your env file
cp .env.example .env

# Edit .env — fill in your values:
#   ANTHROPIC_API_KEY=sk-ant-...
#   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
#   PORT=3001
nano .env

# Install dependencies
npm install

# Seed the regulatory chunks (10 hardcoded GDPR + AML samples)
npm run seed

# Run tests (26 tests, all should be green)
npm test

# Start dev server
npm run dev
```

Backend will be available at `http://localhost:3001`.  
Verify: `curl http://localhost:3001/health` → `{"ok":true}`

## 3 — Frontend setup

```bash
cd ~/vidda-automation/frontend

# Install dependencies
npm install

# Start dev server (proxies /api to localhost:3001)
npm run dev
```

Frontend will be available at `http://localhost:5173`.

## 4 — Using the app

1. Open `http://localhost:5173`
2. Enter your company name and industry
3. Select regulations and set governance scores with the sliders
4. Any score below 70 is flagged as a gap — training modules will be generated for those
5. Click **Generate Training Modules** — watch the live SSE stream as Claude generates each module

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/company` | Save company + governance scores |
| `POST` | `/api/generate` | SSE stream — run full pipeline for a company |
| `GET` | `/api/modules/:companyId` | Fetch all modules with scores + status |
| `PATCH` | `/api/modules/:moduleId` | Approve or reject a module |
| `POST` | `/api/modules/:moduleId/regenerate` | SSE stream — regenerate with rejection reason |

## SSE event types (POST /api/generate)

```
{ type: 'stage',       message: string }
{ type: 'gap_found',   regulation, score, roles }
{ type: 'module_start', regulation, role, moduleId }
{ type: 'chunk',       content, moduleId }
{ type: 'module_done', moduleId, qualityScore }
{ type: 'done' }
{ type: 'error',       message }
```

## Quality score rubric (0–100)

| Criterion | Points |
|-----------|--------|
| Content includes regulation name | +20 |
| Content matches `Article \d+` | +20 |
| Word count 200–500 | +20 |
| Contains `OBJECTIVES` section | +20 |
| Contains `ASSESSMENT` section | +20 |

## Week 2 upgrade path

- Replace `vectorSearch.ts` FTS with pgvector cosine similarity (uncomment index in schema.sql)
- Add `OPENAI_API_KEY` and generate real `text-embedding-3-small` embeddings (1536-dim) for regulatory chunks
- Build Review Dashboard screen

## Project structure

```
~/vidda-automation/
├── backend/src/
│   ├── db/           schema.sql, client.ts, seed.ts
│   ├── routes/       company.ts, generate.ts, modules.ts
│   ├── services/     gapAnalysis.ts, vectorSearch.ts, generation.ts, qualityScore.ts
│   │   └── __tests__/  26 Jest tests (TDD red→green)
│   └── index.ts
└── frontend/src/
    ├── screens/      Onboarding.tsx, Generation.tsx
    ├── components/   ProgressBar.tsx
    └── App.tsx
```
