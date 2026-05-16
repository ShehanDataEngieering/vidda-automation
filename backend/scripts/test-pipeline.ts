/**
 * Integration test — runs the full AMLR pipeline against the live backend.
 *
 * Usage: npx ts-node backend/scripts/test-pipeline.ts
 */

const BACKEND = process.env.API_URL ?? 'http://127.0.0.1:3001';
const COMPANY_ID = '55714874-3a7d-4f0c-816d-d07bc918343d'; // From Clerk metadata
const USER_ID = 'test-user'; // Doesn't matter for this test

const DEMO_ROLE = `KYC Analyst — Enhanced Due Diligence Specialist

What they do:
Conduct Enhanced Due Diligence on high-risk customers. Validate complex ownership structures up to the ultimate beneficial owner. Assess Source of Funds and Source of Wealth for politically exposed persons and clients in high-risk jurisdictions. Perform periodic reviews of existing high-risk client relationships. Escalate suspicious indicators to the MLRO via the internal SAR submission process. Document risk rationales for every client file.

Daily activities:
- Receive EDD cases from the onboarding team when a client triggers enhanced checks
- Review corporate ownership structures to identify beneficial owners holding 25% or more
- Screen clients against global sanctions lists, PEP databases, and adverse media
- Request and validate Source of Funds and Source of Wealth documentation
- Write risk assessment narratives documenting the CDD analysis and decision
- Perform periodic reviews of existing high-risk clients every 12 months
- Escalate accounts with suspicious indicators to the MLRO within 24 hours

Key decisions this person makes:
- Accept or reject a client's EDD documentation as sufficient
- Classify a client's risk tier (standard, elevated, high, prohibited)
- Flag beneficial owners for further investigation
- Recommend account closure where risk is unmanageable

What happens if they make a mistake:
- Illegitimate high-risk customers enter the bank undetected
- The bank faces regulatory fines for CDD failures under AMLR 2024/1624
- Suspicious activity proceeds without SAR reporting — a criminal offence
- The audit trail is compromised, making regulatory inspection impossible`;

interface TestResult {
  step: string;
  passed: boolean;
  duration: number;
  details: string;
  data?: unknown;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, start: number, details: string, data?: unknown) {
  const duration = Date.now() - start;
  const emoji = passed ? '✅' : '❌';
  results.push({ step, passed, duration, details, data });
  console.log(`${emoji} ${step} (${(duration / 1000).toFixed(1)}s) — ${details}`);
  if (data && typeof data === 'object') {
    console.log('   ', JSON.stringify(data).slice(0, 200));
  }
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function patch(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BACKEND}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function get(path: string): Promise<Response> {
  return fetch(`${BACKEND}${path}`);
}

async function main() {
  console.log('=== Vidda Pipeline Integration Test ===\n');
  console.log(`Backend: ${BACKEND}`);
  console.log(`Company: ${COMPANY_ID}\n`);

  // ── Step 0: Health check ──────────────────────────────────────────────────
  let start = Date.now();
  try {
    const res = await get('/health');
    record('Health check', res.ok, start, res.ok ? 'Backend alive' : `Status ${res.status}`);
    if (!res.ok) { console.log('\nBackend not reachable. Aborting.'); return; }
  } catch (err) {
    record('Health check', false, start, String(err));
    return;
  }

  // ── Step 1: Create plan ───────────────────────────────────────────────────
  start = Date.now();
  let planId: string;
  try {
    const res = await post('/api/pipeline', { companyId: COMPANY_ID, createdBy: USER_ID });
    const body = await res.json() as { planId?: string; error?: string };
    if (res.ok && body.planId) {
      planId = body.planId;
      record('Create plan', true, start, `planId=${planId.slice(0, 8)}...`);
    } else {
      record('Create plan', false, start, body.error ?? 'Unknown error');
      return;
    }
  } catch (err) {
    record('Create plan', false, start, String(err));
    return;
  }

  // ── Step 2: Role Analysis ─────────────────────────────────────────────────
  start = Date.now();
  try {
    const res = await post(`/api/pipeline/${planId}/analyze-role`, { roleDescription: DEMO_ROLE });
    const body = await res.json() as Record<string, unknown>;
    if (res.ok && body.roleProfile) {
      const rp = body.roleProfile as Record<string, unknown>;
      record('Role analysis', true, start,
        `Classified: ${rp.classified_as} (${Math.round((rp.classification_confidence as number) * 100)}%) — ${rp.role_title}`,
        { classified_as: rp.classified_as, confidence: rp.classification_confidence }
      );

      if (body.warnings && (body.warnings as string[]).length > 0) {
        console.log(`   ⚠️  Warnings: ${(body.warnings as string[]).join(', ')}`);
      }
    } else {
      record('Role analysis', false, start, JSON.stringify(body).slice(0, 300));
      return;
    }
  } catch (err) {
    record('Role analysis', false, start, String(err));
    return;
  }

  // ── Step 3: Risk Assessment ──────────────────────────────────────────────
  start = Date.now();
  try {
    const res = await post(`/api/pipeline/${planId}/assess-risk`, {});
    const body = await res.json() as Record<string, unknown>;
    if (res.ok && body.riskMatrix) {
      const scores = (body.riskMatrix as Array<{ dimension: string; score: string }>)
        .map(d => `${d.dimension.slice(0, 6)}:${d.score}`).join(', ');
      record('Risk assessment', true, start, scores);
      if (body.warnings && (body.warnings as string[]).length > 0) {
        console.log(`   ⚠️  Warnings: ${(body.warnings as string[]).join(', ')}`);
      }
    } else {
      record('Risk assessment', false, start, JSON.stringify(body).slice(0, 300));
      return;
    }
  } catch (err) {
    record('Risk assessment', false, start, String(err));
    return;
  }

  // ── Step 3b: Risk Override (Gate 1) ─────────────────────────────────────
  start = Date.now();
  try {
    const res = await patch(`/api/pipeline/${planId}/risk`, {
      overrides: { 'Fraud Risk': { score: 'High', justification: 'KYC handles high-risk PEPs — fraud exposure is higher.' } },
      reviewerNote: 'Compliance Officer — adjusted Fraud to High for PEP exposure.',
    });
    const body = await res.json() as Record<string, unknown>;
    if (res.ok && body.riskMatrix) {
      record('Risk override (Gate 1)', true, start, `Version bumped to ${body.version}`);
    } else {
      record('Risk override (Gate 1)', false, start, JSON.stringify(body).slice(0, 200));
    }
  } catch (err) {
    record('Risk override (Gate 1)', false, start, String(err));
  }

  // ── Step 4: AMLR Mapping (RAG) ────────────────────────────────────────────
  start = Date.now();
  try {
    const res = await post(`/api/pipeline/${planId}/map-amlr`, {});
    const body = await res.json() as Record<string, unknown>;
    if (res.ok && body.amlrMappings) {
      const articles = (body.amlrMappings as Array<{ article: string }>).map(m => m.article).join(', ');
      record('AMLR mapping (RAG)', true, start, `Articles mapped: ${articles}`);
      if (body.warnings && (body.warnings as string[]).length > 0) {
        console.log(`   ⚠️  Warnings: ${(body.warnings as string[]).join(', ')}`);
      }
    } else {
      record('AMLR mapping (RAG)', false, start, JSON.stringify(body).slice(0, 300));
      return;
    }
  } catch (err) {
    record('AMLR mapping (RAG)', false, start, String(err));
    return;
  }

  // ── Step 4b: AMLR Override (Gate 2) ─────────────────────────────────────
  start = Date.now();
  try {
    const getRes = await get(`/api/pipeline/${planId}`);
    const plan = await getRes.json() as { amlr_mappings?: Array<Record<string, unknown>> };
    const mappings = plan.amlr_mappings ?? [];

    const res = await patch(`/api/pipeline/${planId}/amlr`, {
      mappings,
      reviewerNote: 'Legal/compliance review — mapping confirmed.',
    });
    if (res.ok) {
      record('AMLR override (Gate 2)', true, start, 'Mapping confirmed');
    } else {
      record('AMLR override (Gate 2)', false, start, 'Failed');
    }
  } catch (err) {
    record('AMLR override (Gate 2)', false, start, String(err));
  }

  // ── Step 5: Training Plan Generation (SSE) ───────────────────────────────
  start = Date.now();
  try {
    const res = await post(`/api/pipeline/${planId}/generate-plan`, {});
    if (!res.ok || !res.body) {
      record('Plan generation (SSE)', false, start, `Status ${res.status}`);
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let done = false;
      let tokenCount = 0;
      const timeout = setTimeout(() => { record('Plan generation (SSE)', false, start, 'Timeout after 120s'); }, 120000);

      try {
        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          fullText += decoder.decode(value, { stream: true });
          // Count tokens by finding data: lines with "token" type
          const lines = fullText.split('\n');
          tokenCount = lines.filter(l => l.includes('"type":"token"')).length;
          if (fullText.includes('"type":"done"')) { done = true; break; }
          if (fullText.includes('"type":"error"')) break;
        }
      } finally {
        clearTimeout(timeout);
      }

      if (done) {
        record('Plan generation (SSE)', true, start, `Streamed ~${tokenCount} tokens over ${((Date.now() - start) / 1000).toFixed(1)}s`);
      } else {
        record('Plan generation (SSE)', false, start, 'Stream ended without done event');
      }
    }
  } catch (err) {
    record('Plan generation (SSE)', false, start, String(err));
  }

  // ── Step 5b: Approve Plan (Gate 3) ──────────────────────────────────────
  start = Date.now();
  try {
    const res = await patch(`/api/pipeline/${planId}/approve`, { reviewer: 'Compliance Manager' });
    const body = await res.json() as Record<string, unknown>;
    if (res.ok && body.status === 'approved') {
      record('Approve plan (Gate 3)', true, start, `Status: ${body.status}, Version: ${body.version}`);
    } else {
      record('Approve plan (Gate 3)', false, start, JSON.stringify(body).slice(0, 200));
    }
  } catch (err) {
    record('Approve plan (Gate 3)', false, start, String(err));
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed (${(totalTime / 1000).toFixed(1)}s total) ===\n`);

  if (failed > 0) {
    console.log('FAILED STEPS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.step}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 Full pipeline passed!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
