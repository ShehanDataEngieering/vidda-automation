# Vidda Automation

A full-stack compliance training platform that combines AI-powered module generation with document management and employee training workflows.

**For Admins**: Generate regulatory training modules, upload compliance documents, manage team access, and review/approve content before rollout.

**For Employees**: Complete assigned compliance training, ask Q&A questions about company documents via semantic search, and track progress.

## Features

- 🔐 **Authentication**: Clerk-powered sign-in with role-based access (admin/employee)
- 📄 **Document Management**: Drag-and-drop PDF uploads with semantic chunking and embeddings
- 🤖 **AI Module Generation**: Claude-powered training content with quality scoring
- 💬 **Compliance Chat**: Q&A grounded in uploaded documents (hybrid BM25 + vector search + reranking)
- 📊 **Training Dashboard**: Assigned modules by regulation, progress tracking
- 👥 **Team Management**: Admin invites employees, role/department assignment
- 📡 **Live SSE Streaming**: Real-time generation and chat response feedback

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL 16 + pgvector (hosted or Docker) |
| **Auth** | Clerk (OAuth + JWT sessions) |
| **AI Models** | Claude 3.5 Sonnet (generation/chat) + Voyage AI (embeddings/reranking) |
| **Container** | Docker + Docker Compose |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (or PostgreSQL 16 installed locally)
- **Clerk account** (free tier): clerk.com
- **Anthropic API key**: console.anthropic.com
- **Voyage AI key**: (free tier has 3 RPM; paid tier unlocked at no charge with valid card)
- WSL 2 / Linux / macOS

## Quick Start

### 1. Clone & Install

```bash
cd ~/vidda-automation

# Install root dependencies (concurrently for dev server)
npm install

# Install backend
npm --prefix backend install

# Install frontend
npm --prefix frontend install
```

### 2. Environment Variables

**Backend** (`backend/.env`):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vidda
ANTHROPIC_API_KEY=sk-ant-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
VOYAGE_API_KEY=pa-...
NODE_ENV=development
PORT=3001
```

**Frontend** (`frontend/.env`):
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

Get these keys from:
- [Clerk Dashboard](https://dashboard.clerk.com) → API Keys
- [Anthropic Console](https://console.anthropic.com) → API Keys
- [Voyage AI Dashboard](https://dash.voyageai.com) → API Keys

### 3. Database

```bash
# Start PostgreSQL in Docker
npm run docker:up

# Wait ~5 seconds for container to initialize, then seed
npm run seed
```

**Expected seed output**:
```
Fetching regulation text from legislation.gov.uk XML API...
GDPR: 108 article chunks fetched — embedding...
GDPR: inserted/updated 108 chunks
AML: 16 article chunks fetched — embedding...
AML: inserted/updated 16 chunks
MIFID2: 184 article chunks fetched — embedding...
MIFID2: inserted/updated 184 chunks
Seeding fallback hardcoded chunks for: DORA
Fallback: seeded 7 chunks
```

### 4. Run Dev Servers

From the **root directory**:

```bash
npm run dev
```

This starts **both** backend (3001) and frontend (5173) simultaneously.

- Backend: http://localhost:3001 (health check: `curl http://localhost:3001/health`)
- Frontend: http://localhost:5173

### 5. First Admin Sign-In

1. Open http://localhost:5173
2. Click "Sign up" → create a Clerk account
3. In [Clerk Dashboard](https://dashboard.clerk.com) → Users → your user → edit
4. Add to `publicMetadata`:
   ```json
   {
     "role": "admin",
     "companyId": "00000000-0000-0000-0000-000000000001",
     "employeeRole": null
   }
   ```
5. Refresh the app — you're now in the admin portal

## Admin Workflow

1. **Company Setup** (tab 1): Create company profile
2. **Generate Modules** (tab 2): AI creates training for regulatory gaps
   - Runs gap analysis against 5 regulations (GDPR, AML, MiFID II, DORA, KYC)
   - Generates content for each gap + role combination
   - Streams live progress via SSE
3. **Review** (tab 3): Approve or reject modules
4. **Final Output** (tab 4): Browse approved modules + audit log
5. **Documents** (tab 5): Upload PDFs for employee Q&A
6. **Team** (tab 6): Invite employees, assign roles/departments

## Employee Workflow

1. **Sign In**: Receive Clerk invitation link from admin → create account
2. **Compliance Chat**: Ask questions about company's compliance documents
   - Grounded answers with citations: `[DocumentName · Section X · p.Y]`
   - Fallback: "This question is not covered in our documents"
3. **My Training**: Complete assigned modules by regulation + role
   - Progress tracking across 5 regulations
   - "Mark as Read" to complete each module

## API Endpoints (Partial List)

### Auth
- `POST /api/auth/set-company` — set user's company + role (admin-only)
- `GET /api/auth/me` — fetch current user context

### Documents
- `POST /api/documents/upload` — upload PDF (admin-only, multipart/form-data, field: `pdf`)
- `GET /api/documents` — list docs in company
- `GET /api/documents/:id/status` — poll processing status
- `DELETE /api/documents/:id` — remove document

### Chat
- `POST /api/chat/sessions` — create chat session + stream answer
- `GET /api/chat/sessions` — list conversations for current user
- `GET /api/chat/sessions/:id/messages` — fetch conversation history
- `POST /api/chat/sessions/:id/messages` — add message + stream answer

### Training
- `GET /api/training/my-modules` — list assigned modules (filtered by employeeRole)
- `POST /api/training/my-modules/:id/complete` — mark module complete
- `GET /api/training/my-progress` — progress summary by regulation

### Team (Admin Only)
- `GET /api/users` — list company users
- `POST /api/users/invite` — send Clerk invitation
- `GET /api/users/invitations` — pending invites
- `PATCH /api/users/:userId/role` — change user role
- `DELETE /api/users/:userId` — remove user from company

## Retrieval Pipeline (Chat)

```
Question → BM25 full-text search → top-5 candidates
        ↓
        Vector search (cosine similarity) → top-5 candidates
        ↓
        Reciprocal Rank Fusion (RRF) → merge + deduplicate → top-15
        ↓
        Voyage AI reranking → top-8
        ↓
        Claude → stream answer with citations
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `companies` | Company metadata + onboarding |
| `risk_profiles` | Gap templates by company |
| `regulatory_chunks` | EUR-Lex regulations (1024-dim embeddings) |
| `document_chunks` | Admin-uploaded PDFs (1024-dim embeddings) |
| `chunk_relationships` | Cross-references between chunks |
| `training_modules` | Generated/approved modules |
| `module_completions` | User completion tracking |
| `chat_sessions` | Per-user chat conversations |
| `chat_messages` | Conversation history + citations |
| `documents` | PDF upload metadata |

All tables include `created_at` timestamps and appropriate indexes for performance.

## Development

### TypeScript
Both backend and frontend are 100% typed with zero `any` types.

```bash
# Check types
npm --prefix backend exec tsc --noEmit
npm --prefix frontend exec tsc --noEmit
```

### Run Tests
```bash
npm --prefix backend test
```

### Code Style
- Prettier (auto-format on save in most editors)
- ESLint (no strict rules, but flagged in CI)

## Deployment

### Docker Compose (Local)
```bash
docker compose up -d
# Services: postgres (5432), pgadmin (5050), backend (3001)
```

### Production
1. Set `NODE_ENV=production` in backend
2. Build: `npm run build --prefix frontend`
3. Deploy frontend to Vercel / Netlify
4. Deploy backend to Railway / Heroku / EC2
5. Use managed PostgreSQL (AWS RDS, Neon, Heroku Postgres)
6. Update environment variables in deployment platform

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `EADDRINUSE` on port 3001/5173 | `pkill -f "node\|vite"` or `fuser -k 3001/tcp` |
| Seed fails with 401 | Check `VOYAGE_API_KEY` is set and valid |
| Seed fails with 429 | Rate limit hit; wait 2 minutes or upgrade Voyage tier |
| Chat returns "not grounded" | Check PDFs were uploaded + processed (status: ready) |
| Employees can't sign in | Verify `publicMetadata` includes `companyId` + `role` in Clerk |

## Project Structure

```
vidda-automation/
├── backend/
│   ├── src/
│   │   ├── db/                schema.sql, client.ts, seed.ts
│   │   ├── middleware/        auth.ts (Clerk)
│   │   ├── routes/            company, generate, modules, auth, documents, chat, training, users
│   │   ├── services/rag/      htmlChunker, embeddings, reranker, documentSearch, chatGeneration
│   │   ├── utils/             logger.ts, user.ts, getUser.ts
│   │   └── index.ts           Express server
│   ├── .env                   environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── screens/           Onboarding, Generation, ReviewDashboard, FinalOutput, DocumentManager, ComplianceChat, TrainingDashboard, UserManagement
│   │   ├── components/        NavBar, ui components (shadcn)
│   │   ├── utils/             api.ts (Clerk token injection)
│   │   ├── types.ts           TypeScript interfaces
│   │   └── App.tsx            Main router
│   ├── .env                   environment variables
│   └── package.json
├── docker-compose.yml         PostgreSQL + pgAdmin
├── package.json               root (concurrently, docker-compose)
└── README.md                  this file
```

## License

Proprietary — Vidda Automation 2025
