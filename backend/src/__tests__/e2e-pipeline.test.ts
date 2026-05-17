/**
 * E2E Pipeline Automation Test
 * Run: npx ts-node --transpile-only src/__tests__/e2e-pipeline.test.ts
 * 
 * Monkey-patches Clerk auth middleware, then runs all 14 pipeline steps.
 */
import { config } from 'dotenv';
config();

// ── Phase 1: Monkey-patch auth middleware BEFORE pipeline router loads ──
const authModule = require('../middleware/auth');
const { db } = require('../db/client');

let TEST_USER_ID = 'e2e-test-admin';
let TEST_COMPANY_ID = '';

// Auth mock reads from mutable vars (set during setup)
// Simulates real Clerk behavior: sessionClaims does NOT include publicMetadata,
// so our resolveAuthUser middleware must provide it via req.resolvedUser.
authModule.requireSignedIn = (req: any, _res: any, next: any) => next();
authModule.requireRole = () => (_req: any, _res: any, next: any) => next();
authModule.resolveAuthUser = (req: any, _res: any, next: any) => {
  req.resolvedUser = {
    userId: TEST_USER_ID,
    publicMetadata: { role: 'admin', companyId: TEST_COMPANY_ID, employeeRole: null },
  };
  next();
};
authModule.resolveAuthUser = (req: any, _res: any, next: any) => {
  req.resolvedUser = {
    userId: TEST_USER_ID,
    publicMetadata: { role: 'admin', companyId: TEST_COMPANY_ID, employeeRole: null },
  };
  next();
};

// ── Phase 2: Load pipeline router (uses patched middleware) ──
import express from 'express';
import request from 'supertest';
import { pipelineRouter } from '../routes/pipeline';

const app = express();
app.use(express.json());
app.use(authModule.resolveAuthUser); // Populate req.resolvedUser before routes
app.use('/api/pipeline', pipelineRouter);

let planId = '';
let passed = 0;
let failed = 0;

function log(step: string, ok: boolean, detail?: string) {
  const icon = ok ? '✅' : '❌';
  if (ok) passed++; else failed++;
  console.log(`${icon} ${step}${detail ? ' — ' + detail : ''}`);
}

async function setupCompany(): Promise<boolean> {
  try {
    const { rows } = await db.query("SELECT id FROM companies WHERE name = 'E2E Test Company' LIMIT 1");
    if (rows[0]) { TEST_COMPANY_ID = rows[0].id; console.log('Found test company:', TEST_COMPANY_ID.slice(0,8)); return true; }
    const { rows: inserted } = await db.query(
      "INSERT INTO companies (name, industry, size) VALUES ('E2E Test Company', 'Banking', '51-200') RETURNING id"
    );
    TEST_COMPANY_ID = inserted[0].id;
    console.log('Created test company:', TEST_COMPANY_ID.slice(0,8));
    return true;
  } catch (e: any) {
    console.error('Company setup failed:', e.message);
    return false;
  }
}

async function run() {
  console.log('\n=== E2E Pipeline Automation ===\n');

  if (!(await setupCompany())) { process.exit(1); return; }

  // ── Step 1: Create Plan ──
  try {
    const res = await request(app).post('/api/pipeline').send({});
    const ok = res.status === 201 && !!res.body.planId;
    log('POST /api/pipeline (create)', ok, `planId=${(res.body.planId as string | undefined)?.slice(0,8) ?? 'N/A'}...`);
    if (!ok) { console.log('  Response:', JSON.stringify(res.body)); return; }
    planId = res.body.planId as string;
  } catch (e) { log('POST /api/pipeline', false, String(e)); return; }

  // ── Step 2: Fetch Plan ──
  try {
    const res = await request(app).get(`/api/pipeline/${planId}`);
    log('GET /api/pipeline/:id', res.status === 200 && res.body.id === planId, `status=${res.body.status}`);
  } catch (e) { log('GET /api/pipeline/:id', false, String(e)); }

  // ── Step 3: List All ──
  try {
    const res = await request(app).get('/api/pipeline');
    log('GET /api/pipeline (list)', res.status === 200 && Array.isArray(res.body), `count=${res.body?.length}`);
  } catch (e) { log('GET /api/pipeline (list)', false, String(e)); }

  // ── Step 4: Analyze Role ──
  try {
    const desc = `KYC Analyst — Enhanced Due Diligence Specialist.
Conduct EDD on high-risk customers. Validate ownership structures.
Perform periodic reviews. Escalate to MLRO. Document risk rationales.
Key decisions: Accept/reject EDD docs, classify risk tier, flag beneficial owners.
Mistake impact: High-risk customers enter undetected, regulatory fines.`;
    const res = await request(app).post(`/api/pipeline/${planId}/analyze-role`).send({ roleDescription: desc });
    const ok = res.status === 200 && !!res.body.roleProfile;
    log('POST /:id/analyze-role', ok,
      ok ? `classified=${res.body.roleProfile.classified_as} conf=${Math.round(res.body.roleProfile.classification_confidence * 100)}%` :
        `status=${res.status} ${JSON.stringify(res.body).slice(0, 80)}`);
  } catch (e) { log('POST /:id/analyze-role', false, String(e)); }

  // ── Step 5: PATCH clarify ──
  try {
    const res = await request(app).patch(`/api/pipeline/${planId}/role`).send({
      roleDescription: 'Clarified: reports to FCA and BaFin.',
      roleProfile: { role_title: 'KYC Analyst', clarifications: { reg: 'FCA' } },
    });
    log('PATCH /:id/role (clarify)', res.status === 200 && res.body.ok, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/role', false, String(e)); }

  // ── Step 6: Assess Risk ──
  try {
    const res = await request(app).post(`/api/pipeline/${planId}/assess-risk`).send({});
    const ok = res.status === 200 && Array.isArray(res.body.riskMatrix);
    let detail = ok ? `dims=${res.body.riskMatrix.length}` : `err=${JSON.stringify(res.body).slice(0, 80)}`;
    if (ok && res.body.riskMatrix.length > 0) {
      detail = (res.body.riskMatrix as Array<{ dimension: string; score: string }>).map(d => `${d.dimension}:${d.score}`).join(', ');
    }
    log('POST /:id/assess-risk', ok, detail);
  } catch (e) { log('POST /:id/assess-risk', false, String(e)); }

  // ── Step 7: Override Risk ──
  try {
    const res = await request(app).patch(`/api/pipeline/${planId}/risk`).send({
      overrides: { 'AML Risk': { score: 'Critical', justification: 'E2E override' } },
      reviewerNote: 'E2E automation',
    });
    log('PATCH /:id/risk (override)', res.status === 200 && !!res.body.riskMatrix, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/risk', false, String(e)); }

  // ── Step 8: Map AMLR ──
  try {
    const res = await request(app).post(`/api/pipeline/${planId}/map-amlr`).send({});
    const ok = res.status === 200 && Array.isArray(res.body.amlrMappings);
    let detail = ok ? `articles=${res.body.amlrMappings.length}` : `err=${JSON.stringify(res.body).slice(0, 80)}`;
    if (ok && res.body.amlrMappings.length > 0) {
      detail = 'articles=' + (res.body.amlrMappings as Array<{ article: string }>).map(m => m.article).join(', ');
    }
    log('POST /:id/map-amlr', ok, detail);
  } catch (e) { log('POST /:id/map-amlr', false, String(e)); }

  // ── Step 9: Confirm AMLR ──
  try {
    const getRes = await request(app).get(`/api/pipeline/${planId}`);
    const res = await request(app).patch(`/api/pipeline/${planId}/amlr`).send({
      mappings: getRes.body.amlr_mappings,
      reviewerNote: 'E2E confirmed',
    });
    log('PATCH /:id/amlr (confirm)', res.status === 200, `version=${res.body.version}`);
  } catch (e) { log('PATCH /:id/amlr', false, String(e)); }

  // ── Step 10: Generate Plan (SSE) ──
  let planGenerated = false;
  try {
    let rawBody = '';
    const res = await request(app)
      .post(`/api/pipeline/${planId}/generate-plan`)
      .send({})
      .buffer(false)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          rawBody = Buffer.concat(chunks).toString();
          callback(null, rawBody);
        });
        res.on('error', (e: Error) => callback(e, ''));
      });

    const events = rawBody.split('\n')
      .filter(l => l.startsWith('data:'))
      .map(l => { try { return JSON.parse(l.replace('data: ', '')); } catch { return null; } }).filter(Boolean);
    const doneEvent = events.find((e: any) => e.type === 'done');
    const errorEvent = events.find((e: any) => e.type === 'error');
    planGenerated = !!doneEvent;
    log('SSE generate-plan', planGenerated,
      doneEvent ? `quarters=${doneEvent.plan?.quarters?.length} tokens=${events.filter((e: any) => e.type === 'token').length}` :
      errorEvent ? `AI error: ${errorEvent.message}` : 'no done/error event');
  } catch (e) { log('SSE generate-plan', false, String(e)); }

  // ── Step 11: Approve + Assign ──
  if (!planGenerated) {
    console.log('\n⚠  Plan gen failed — skipping approve/assign.\n');
  } else {
    try {
      const getRes = await request(app).get(`/api/pipeline/${planId}`);
      if (getRes.body.status === 'draft') {
        const res = await request(app).patch(`/api/pipeline/${planId}/approve`).send({ reviewer: 'E2E' });
        log('PATCH /:id/approve', res.status === 200, `version=${res.body.version}`);
      } else {
        log('PATCH /:id/approve', true, `already ${getRes.body.status}`);
      }
    } catch (e) { log('PATCH /:id/approve', false, String(e)); }

    try {
      const res = await request(app).post(`/api/pipeline/${planId}/assign`).send({
        userIds: ['employee@vidda.dev'], dueDate: '2026-12-31',
      });
      log('POST /:id/assign', res.status === 200, `assigned=${res.body.assigned}`);
    } catch (e) { log('POST /:id/assign', false, String(e)); }
  }

  // ── Step 12: Final state ──
  try {
    const res = await request(app).get(`/api/pipeline/${planId}`);
    const p = res.body;
    log('GET /:id (final)', true, `step=${p.current_step} status=${p.status} hasProfile=${!!p.role_profile} hasRisk=${!!p.risk_matrix} hasAMLR=${!!p.amlr_mappings} hasPlan=${!!p.training_plan}`);
  } catch (e) { log('GET /:id (final)', false, String(e)); }

  // ── Step 13: Assignments list ──
  try {
    const res = await request(app).get('/api/pipeline/assignments/all');
    log('GET /assignments/all', res.status === 200, `count=${res.body?.length ?? 0}`);
  } catch (e) { log('GET /assignments/all', false, String(e)); }

  // ── Final cleanup ──
  try { await db.query('DELETE FROM training_plans WHERE company_id = $1', [TEST_COMPANY_ID]); } catch {}

  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} passed${failed > 0 ? ` (${failed} failed)` : ' — ALL GREEN'} ===\n`);
  if (failed > 0) process.exitCode = 1;
}

run();
