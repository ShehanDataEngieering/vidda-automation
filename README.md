# Vidda — AMLR Compliance Training Automation

> **AMLR 2024/1624 comes into force in 2027.** Every EU financial institution must ensure every employee has role-specific compliance training mapped to the correct regulatory obligations. Today that's done manually — by lawyers, in spreadsheets, taking weeks per role. Vidda automates it end-to-end.

**Live:** [vidda-automation.vercel.app](https://vidda-automation.vercel.app) · API: [vidda-automation-backend.onrender.com](https://vidda-automation-backend.onrender.com/health)

![Pipeline walkthrough](frontend/public/media/pipeline-walkthrough.gif)

---

## What It Does

A compliance officer pastes a job description. Vidda extracts the role's risk exposure, maps it to real AMLR articles using RAG on the EUR-Lex PDF, generates a 4-quarter progressive training plan, and logs every decision in an immutable audit trail — ready for FCA/national supervisor inspection.

**The key viability concern we solve:** Can AI reliably map a free-text job description to the correct AMLR obligations without hallucinating regulatory requirements? Our answer: RAG on the actual AMLR PDF + human approval gate + immutable audit trail.

---

## Pipeline (Admin)

```
Job Description → Role Profile → Risk Matrix → AMLR Article Mapping → Training Plan → LMS Assignment
                                                        ↑
                                              RAG on real EUR-Lex AMLR PDF
                                              (BM25 + pgvector + Voyage reranking)
```

| Step | What Happens |
|------|-------------|
| **1. Role Import** | AI reads free-text job description, extracts risk dimensions (AML, Sanctions, Fraud, Documentation) |
| **2. Risk Assessment** | Generates risk matrix — maps role exposure to regulatory risk levels |
| **3. AMLR Mapping** | RAG on actual AMLR PDF → maps gaps to specific articles (Article 8, 12, 13, 16...) |
| **4. Training Plan** | Generates 4-quarter progressive plan — Q1 awareness → Q4 mastery, zero repetition |
| **5. Human Approval** | Compliance officer reviews and approves before anything reaches employees |
| **6. LMS Assignment** | Assign plan to employees by email, track completion |

Every step is logged in an **immutable audit trail** — AI generation, human overrides, approvals — all timestamped.

---

## Employee View

Employees log in and see their personal training plan with:
- Which modules they need this quarter
- **Why** they specifically need each module (AMLR article + rationale)
- Completion tracking across Q1–Q4

AMLR Article 12 requires employees to understand *why* they're doing training. We surface that automatically.

---

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL 16 + pgvector |
| **Auth** | Clerk (JWT sessions, role-based access) |
| **AI** | Claude via the direct Anthropic API (`claude-sonnet-4-5`) |
| **Embeddings** | Voyage AI `voyage-finance-2` (finance/legal-tuned, 1024-dim) |
| **Reranking** | Voyage AI `voyage-rerank-2` cross-encoder |
| **Container** | Docker + Docker Compose |

### Why Voyage AI over OpenAI embeddings
`voyage-finance-2` is trained on financial and legal documents. For domain-specific terminology like "enhanced due diligence", "sanctions screening", "Article 13 obligations" — cosine similarity is meaningfully better than a general-purpose model.

---

## Retrieval Pipeline

```
Role description / query
        ↓
BM25 full-text search  +  Vector search (cosine similarity)
        ↓                          ↓
              Reciprocal Rank Fusion (RRF)
                        ↓
              Voyage AI reranking (top-8)
                        ↓
              Claude — grounded answer with article citations
```

No hallucinated citations — every claim traces back to a chunk from the real AMLR PDF.

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `training_plans` | Full pipeline state per role (JSONB: role_profile, risk_matrix, amlr_mappings, training_plan) |
| `plan_events` | Immutable audit log — every AI generation, override, approval |
| `plan_assignments` | Employee ↔ training plan with status + completion tracking |
| `regulatory_chunks` | EUR-Lex AMLR chunks with 1024-dim embeddings |
| `document_chunks` | Admin-uploaded PDFs with embeddings |
| `chunk_relationships` | Cross-references between regulatory chunks |
| `companies` | Company metadata |
| `chat_sessions` / `chat_messages` | Employee compliance Q&A history |

---

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (or PostgreSQL 16 locally)
- [Clerk account](https://clerk.com) — free tier
- [Anthropic API key](https://platform.claude.com/settings/billing) — for Claude
- [Voyage AI key](https://dash.voyageai.com) — for embeddings + reranking

---

## Quick Start

### 1. Clone & Install

```bash
# Install all dependencies
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Environment Variables

**`backend/.env`:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vidda_automation
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
VOYAGE_API_KEY=pa-...
PORT=3001
# Comma-separated list of allowed frontend origins for CORS
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

### 3. Database

```bash
# Start PostgreSQL
npm run docker:up

# Apply the schema (pgvector extension + tables)
psql "$DATABASE_URL" -f backend/src/db/sql/schema.sql

# Seed AMLR regulatory chunks + demo data (calls Anthropic + Voyage — costs credits)
npm run seed
```

### 4. Run Dev Servers

```bash
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### 5. First Admin Setup

Sign-up is fully self-serve — no Clerk dashboard editing needed:

1. Sign up at http://localhost:5173
2. Fill out the company onboarding form (name, industry, size) — `POST /api/companies` creates the company row and attaches `companyId` + `role: admin` to your Clerk `publicMetadata` in one step
3. You're in the admin pipeline

---

## Project Structure

```
vidda-automation/
├── backend/src/
│   ├── routes/
│   │   ├── pipeline.ts        Main pipeline (role → risk → AMLR → plan → LMS)
│   │   ├── training.ts        Employee plan assignments + completion
│   │   ├── auth.ts            Clerk session management
│   │   ├── documents.ts       PDF upload + processing
│   │   └── chat.ts            Employee compliance Q&A
│   ├── services/llm/
│   │   ├── pipelinePrompt.ts  Role analysis + training plan generation prompts
│   │   ├── archetypes.ts      AMLR role archetypes + risk dimensions
│   │   └── qualityScorer.ts   Plan quality scoring
│   ├── db/
│   │   ├── schema.sql         Full DB schema
│   │   ├── sql/               Migration files
│   │   └── seeds/             AMLR regulatory chunk seeding
│   └── index.ts               Express server
├── frontend/src/
│   ├── screens/
│   │   ├── PipelinePage.tsx   Dashboard — list all plans
│   │   ├── RoleImport.tsx     Step 1 — job description input
│   │   ├── RiskAssessment.tsx Step 2 — risk matrix
│   │   ├── AMLRMapping.tsx    Step 3 — article mapping
│   │   ├── TrainingPlan.tsx   Step 4 — plan review + audit trail
│   │   ├── LMSView.tsx        Step 5 — assign to employees
│   │   └── LMSDashboard.tsx   Employee — personal training plan
│   ├── components/
│   │   └── PipelineStepper.tsx  Step navigation
│   └── App.tsx                React Router setup
├── docker-compose.yml
└── README.md
```

---

## Deployment

Live stack: **Neon** (Postgres + pgvector) → **Render** (backend) → **Vercel** (frontend).

| Piece | Where | Notes |
|-------|-------|-------|
| Database | [Neon](https://console.neon.tech) | Free tier. Connection string needs `?sslmode=require`; `backend/src/db/client.ts` already handles SSL for any non-localhost `DATABASE_URL`. |
| Backend | [Render](https://dashboard.render.com) — free Web Service | Root dir `backend`, build `npm install && npm run build`, start `npm start`, health check `/health`. **Do not set `PORT`** — Render injects its own and the app already does `process.env.PORT ?? 3001`; a hardcoded `PORT` env var will break routing. |
| Frontend | [Vercel](https://vercel.com) | Root dir `frontend`. `frontend/vercel.json` adds the SPA rewrite (`/(.*) → /index.html`) needed because the app uses `BrowserRouter` — without it, deep links 404 on refresh. |

**Env var wiring (order matters):**
- Render's `FRONTEND_URL` (used for CORS) and Vercel's `VITE_API_URL` are mutually dependent — deploy Render first with a placeholder `FRONTEND_URL`, deploy Vercel pointing at the real Render URL, then go back and set Render's `FRONTEND_URL` to the real Vercel URL.
- Vite inlines `VITE_*` env vars at **build time** — changing `VITE_API_URL` later requires a new Vercel deploy, not just an env var edit.
- `frontend/.env` / `backend/.env` are never touched by the deploy — Render/Vercel get their env vars entered directly in each dashboard (their "Add from .env" import buttons can bulk-import your local `.env` files, but double-check anything environment-specific like `DATABASE_URL`/`FRONTEND_URL` before deploying).

A `render.yaml` blueprint also exists at the repo root for a one-click "New from Blueprint" deploy on Render — note Render currently requires a card on file for Blueprint deploys specifically (not for a plain free Web Service), so the live backend above was set up via the regular "New Web Service" flow instead.

To seed the deployed database from your machine (spends Anthropic + Voyage API credits):
```bash
DATABASE_URL="<neon-connection-string>" npm run seed --prefix backend
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE` port 3001 | `fuser -k 3001/tcp` |
| Plans not loading | Check `ANTHROPIC_API_KEY` is valid |
| Employee sees empty training | Verify `publicMetadata.companyId` matches plan's company |
| Clerk sign-in blocked by email verification | Use sign-in token: `POST /v1/sign_in_tokens` |

---

## License

Proprietary — Vidda 2025
