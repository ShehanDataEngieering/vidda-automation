/**
 * E2E Automation Test — Pipeline Flow
 * Run: npx ts-node src/__tests__/e2e-pipeline.test.ts
 * Tests every pipeline step against real DB + AI via OpenRouter
 */
import express from 'express';
import request from 'supertest';
import { pipelineRouter } from '../routes/pipeline';

// ── Mock Clerk middleware ──
const TEST_USER_ID = 'e2e-test-admin';
const TEST_COMPANY_ID = 'e2e-company-001';

function mockClerkMw(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  (req as unknown as Record<string, unknown>).auth = {
    userId: TEST_USER_ID,
    sessionClaims: {
      publicMetadata: {
        role: 'admin',
        companyId: TEST_COMPANY_ID,
        employeeRole: null,
      },
    },
  };
  next();
}

const app = express();
app.use(express.json());
app.use(mockClerkMw);
app.use('/api/pipeline', pipelineRouter);

let planId = '';
let passed = 0;
let failed = 0;

function log(step: string, ok: boolean, detail?: string) {
  const icon = ok ? '✅' : '❌';
  if (ok) passed++; else failed++;
  console.log(`${icon} ${step}${detail ? ' — ' + detail : ''}`);
}

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n=== E2E Pipeline Automation ===\n');

  // ── Step 1: Create Plan ──
  try {
    const res = await request(app).post('/api/pipeline').send({});
    const ok = res.status === 201 && !!res.body.planId;
    log('POST /api/pipeline (create)', ok, `planId=${res.body.planId?.slice(0,8) ?? 'N/A'}...`);
    if (ok) planId = res.body.planId;
    else { console.log('  Response:', JSON.stringify(res.body)); return; }
  } catch (e) { log('POST /api/pipeline', false, String(e)); return; }

  // ── Step 2: Fetch Plan ──
  try {
    const res = await request(app).get(`/api/pipeline/${planId}`);
    const ok = res.status === 200 && res.body.id === planId;
    log('GET /api/pipeline/:id', ok, `status=${res.body.status}`);
  } catch (e) { log('GET /api/pipeline/:id', false, String(e)); }

  // ── Step 3: List All ──
  try {
    const res = await request(app).get('/api/pipeline');
    const ok = res.status === 200 && Array.isArray(res.body);
    log('GET /api/pipeline (list)', ok, `count=${res.body.length}`);
  } catch (e) { log('GET /api/pipeline (list)', false, String(e)); }

  // ── Step 4: Analyze Role ──
  try {
    const desc = `KYC Analyst — Enhanced Due Diligence Specialist.
Conduct EDD on high-risk customers. Validate complex ownership structures.
Perform periodic reviews. Escalate suspicious indicators to MLRO. Document risk rationales for every client file.
Daily: Review corporate structures, screen against sanctions lists, request and validate SoF/SoW docs.
Key decisions: Accept/reject EDD documentation, classify risk tier, flag beneficial owners.
Mistake impact: High-risk customers enter undetected, regulatory fines, compromised audit trail.`;
    const res = await request(app).post(`/api/pipeline/${planId}/analyze-role`).send({ roleDescription: desc });
    const ok = res.status === 200 && !!res.body.roleProfile;
    log('POST /:id/analyze-role', ok,
      ok ? `classified=${res.body.roleProfile.classified_as} conf=${Math.round(res.body.roleProfile.classification_confidence * 100)}%` :
        `status=${res.status} body=${JSON.stringify(res.body).slice(0, 100)}`);
  } catch (e) { log('POST /:id/analyze-role', false, String(e)); }

  // ── Step 5: PATCH role (clarifications) ──
  try {
    const res = await request(app).patch(`/api/pipeline/${planId}/role`).send({
      roleDescription: 'KYC Analyst with clarification: reports to FCA and BaFin, uses ComplyAdvantage for screening.',
      roleProfile: { role_title: 'KYC Analyst', clarifications: { regulators: 'FCA, BaFin', systems: 'ComplyAdvantage, World-Check' } },
    });
    const ok = res.status === 200 && res.body.ok;
    log('PATCH /:id/role (clarify)', ok, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/role', false, String(e)); }

  // ── Step 6: Assess Risk ──
  try {
    const res = await request(app).post(`/api/pipeline/${planId}/assess-risk`).send({});
    const ok = res.status === 200 && Array.isArray(res.body.riskMatrix);
    let detail = ok ? `dims=${res.body.riskMatrix.length}` : `status=${res.status} ${JSON.stringify(res.body).slice(0, 100)}`;
    if (ok && res.body.riskMatrix.length > 0) {
      const scores = res.body.riskMatrix.map((d: { dimension: string; score: string }) => `${d.dimension}:${d.score}`).join(', ');
      detail = scores;
    }
    log('POST /:id/assess-risk', ok, detail);
  } catch (e) { log('POST /:id/assess-risk', false, String(e)); }

  // ── Step 7: Override Risk ──
  try {
    const res = await request(app).patch(`/api/pipeline/${planId}/risk`).send({
      overrides: { 'AML Risk': { score: 'Critical', justification: 'E2E test: heightened AML exposure' } },
      reviewerNote: 'E2E automation override',
    });
    const ok = res.status === 200 && !!res.body.riskMatrix;
    log('PATCH /:id/risk (override)', ok, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/risk', false, String(e)); }

  // ── Step 8: Map AMLR ──
  try {
    const res = await request(app).post(`/api/pipeline/${planId}/map-amlr`).send({});
    const ok = res.status === 200 && Array.isArray(res.body.amlrMappings);
    let detail = ok ? `articles=${res.body.amlrMappings.length}` : `status=${res.status} ${JSON.stringify(res.body).slice(0, 100)}`;
    if (ok && res.body.amlrMappings.length > 0) {
      detail = `articles=${res.body.amlrMappings.map((m: { article: string }) => m.article).join(', ')}`;
    }
    log('POST /:id/map-amlr', ok, detail);
  } catch (e) { log('POST /:id/map-amlr', false, String(e)); }

  // ── Step 9: Confirm AMLR ──
  try {
    const getRes = await request(app).get(`/api/pipeline/${planId}`);
    const mappings = getRes.body.amlr_mappings;
    const res = await request(app).patch(`/api/pipeline/${planId}/amlr`).send({
      mappings,
      reviewerNote: 'E2E confirmed',
    });
    const ok = res.status === 200;
    log('PATCH /:id/amlr (confirm)', ok, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/amlr', false, String(e)); }

  // ── Step 10: Generate Training Plan (SSE) ──
  let planGenerated = false;
  try {
    let body = '';
    const req = request(app).post(`/api/pipeline/${planId}/generate-plan`).send({});
    req.parse((res: { on: (event: string, cb: (chunk: Buffer) => void) => void; setEncoding: (enc: string) => void }, callback: (err: Error | null, bodyStr: string) => void) => {
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => callback(null, body));
    });
    const res = await req;

    const events = (res.text ?? '').split('\n')
      .filter((l: string) => l.startsWith('data:'))
      .map((l: string) => {
        try { return JSON.parse(l.replace('data: ', '')); } catch { return null; }
      }).filter(Boolean);

    const doneEvent = events.find((e: { type: string }) => e.type === 'done');
    const errorEvent = events.find((e: { type: string }) => e.type === 'error');
    planGenerated = !!doneEvent;

    log('POST /:id/generate-plan (SSE)', planGenerated,
      doneEvent ? `quarters=${doneEvent.plan?.quarters?.length ?? '?'} tokens=${events.filter((e: { type: string }) => e.type === 'token').length}` :
      errorEvent ? `error=${errorEvent.message}` : 'no done/error event');
  } catch (e) { log('POST /:id/generate-plan', false, String(e)); }

  if (!planGenerated) {
    console.log(`\n⚠️  Plan generation failed — skipping approve/assign.\n`);
  } else {
    // ── Step 11: Approve Plan ──
    try {
      // Plan needs to be in draft status — after regen it might be approved already
      const getRes = await request(app).get(`/api/pipeline/${planId}`);
      if (getRes.body.status === 'draft') {
        const res = await request(app).patch(`/api/pipeline/${planId}/approve`).send({ reviewer: 'E2E Reviewer' });
        const ok = res.status === 200 && res.body.status === 'approved';
        log('PATCH /:id/approve', ok, `version=${res.body.version}`);
      } else {
        log('PATCH /:id/approve', true, `already ${getRes.body.status}`);
      }
    } catch (e) { log('PATCH /:id/approve', false, String(e)); }

    // ── Step 12: Assign Plan ──
    try {
      const res = await request(app).post(`/api/pipeline/${planId}/assign`).send({
        userIds: ['employee@vidda.dev'],
        dueDate: '2026-12-31',
      });
      const ok = res.status === 200 && res.body.ok;
      log('POST /:id/assign', ok, `assigned=${res.body.assigned}`);
    } catch (e) { log('POST /:id/assign', false, String(e)); }
  }

  // ── Step 13: Final state ──
  try {
    const res = await request(app).get(`/api/pipeline/${planId}`);
    const p = res.body;
    const ok = res.status === 200;
    log('GET /:id (final)', ok,
      `step=${p.current_step} status=${p.status} hasProfile=${!!p.role_profile} hasRisk=${!!p.risk_matrix} hasAMLR=${!!p.amlr_mappings} hasPlan=${!!p.training_plan}`);
  } catch (e) { log('GET /:id (final)', false, String(e)); }

  // ── Step 14: Assignments list ──
  try {
    const res = await request(app).get('/api/pipeline/assignments/all');
    const ok = res.status === 200 && Array.isArray(res.body);
    log('GET /api/pipeline/assignments/all', ok, `count=${res.body.length}`);
  } catch (e) { log('GET /api/pipeline/assignments/all', false, String(e)); }

  // ── Summary ──
  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} passed${failed > 0 ? ` (${failed} failed)` : ' — ALL GREEN 🎉'} ===\n`);
  if (failed > 0) process.exit(1);
}

run();
