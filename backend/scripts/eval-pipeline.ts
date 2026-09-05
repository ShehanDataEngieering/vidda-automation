/**
 * Pipeline Quality Eval Harness
 * Run: npm run eval:pipeline
 *
 * Drives all 5 known role archetypes through the real pipeline (analyze-role →
 * assess-risk → map-amlr → generate-plan) against the live Anthropic API, then
 * reports classification accuracy and the existing qualityScorer.ts breakdown
 * for each. Use this as a regression check whenever the model, prompts, or
 * provider (e.g. the OpenRouter → Anthropic migration) change — compare the
 * numbers before/after.
 *
 * Reuses the same auth-mocking harness as src/__tests__/e2e-pipeline.test.ts.
 */
import { config } from 'dotenv';
config();

const authModule = require('../src/middleware/auth');
const { db } = require('../src/db/client');

const TEST_USER_ID = 'eval-harness-admin';
let TEST_COMPANY_ID = '';

authModule.requireSignedIn = (_req: any, _res: any, next: any) => next();
authModule.requireRole = () => (_req: any, _res: any, next: any) => next();
authModule.resolveAuthUser = (req: any, _res: any, next: any) => {
  req.resolvedUser = {
    userId: TEST_USER_ID,
    publicMetadata: { role: 'admin', companyId: TEST_COMPANY_ID, employeeRole: null },
  };
  next();
};

import express from 'express';
import request from 'supertest';
import { pipelineRouter } from '../src/routes/pipeline';
import { ARCHETYPE_MAP } from '../src/services/llm/archetypes';

const app = express();
app.use(express.json());
app.use(authModule.resolveAuthUser);
app.use('/api/pipeline', pipelineRouter);

// One representative free-text role description per archetype (vidda_AI_context_brief.md Section 3)
const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Customer Advisor': `Customer Advisor — Frontline Banking
Handles customer enquiries, onboards new customers, verifies ID documents at account opening, and recognises and escalates suspicious behaviour to the KYC team.
Daily activities: Greet and assist customers at the branch or via phone; onboard new customers by collecting and verifying ID documents; process routine transactions; watch for irregular customer behaviour; escalate suspicious activity per internal procedure.
Key decisions: Whether ID documents presented are genuine and sufficient; whether a customer's behaviour warrants escalation; whether to proceed with or pause a transaction pending review.
Mistake impact: Weak ID verification lets bad actors open accounts undetected; missed red flags allow suspicious activity to continue unmonitored; failure to escalate breaches internal AML controls.`,

  'KYC Analyst': `KYC Analyst — Enhanced Due Diligence Specialist
Conducts Enhanced Due Diligence on high-risk customers. Validates complex ownership structures up to the ultimate beneficial owner. Assesses Source of Funds and Source of Wealth for politically exposed persons and high-risk-jurisdiction clients. Performs periodic reviews of existing high-risk relationships. Escalates suspicious indicators to the MLRO.
Daily activities: Receive EDD cases triggered by onboarding; review corporate ownership structures to identify beneficial owners; screen clients against sanctions lists, PEP databases, and adverse media; validate Source of Funds/Wealth documentation; write risk assessment narratives; perform periodic reviews of high-risk clients.
Key decisions: Accept or reject a client's EDD documentation; classify a client's risk tier; flag beneficial owners for further investigation; recommend account closure where risk is unmanageable.
Mistake impact: Illegitimate high-risk customers enter undetected; the bank faces regulatory fines for CDD failures; suspicious activity proceeds without SAR reporting; the audit trail is compromised.`,

  'TM Analyst': `Transaction Monitoring (TM) Analyst — Investigative
Reviews automated transaction monitoring alerts daily. Investigates flagged transactions against customer profiles and history. Decides whether to discard, continue monitoring, or escalate as a Suspicious Activity Report (SAR). Documents investigation notes and rationale for every decision.
Daily activities: Triage the daily queue of TM system alerts; pull customer transaction history and KYC profile for each alert; assess whether the pattern is explainable or suspicious; write up investigation notes; escalate confirmed suspicious cases to the MLRO within regulatory timeframes.
Key decisions: Discard, continue monitoring, or escalate each alert as a SAR; how much investigative depth a given alert warrants; when a pattern matches a known money laundering typology.
Mistake impact: A missed alert lets layering or integration proceed undetected; alert fatigue from high volumes causes rushed, poor-quality decisions; late escalation breaches regulatory SAR filing timeframes.`,

  'AML DDI Manager': `AML Due Diligence & Investigations (DDI) Manager — Second Line Management
Manages KYC/AML due diligence searches on delivery partners and third-party suppliers. Oversees periodic reviews of existing partners. Maintains the data asset register for GDPR compliance. Coaches and quality-checks the analyst team's work. Reports findings to the Senior Manager.
Daily activities: Review and approve analyst due-diligence write-ups on third parties; schedule and oversee periodic partner reviews; maintain and audit the GDPR data asset register; provide coaching and quality feedback to analysts; escalate high-risk partner findings to senior management.
Key decisions: Whether a third-party partner passes due diligence or requires further investigation; whether an analyst's quality-check reveals a systemic gap needing retraining; how to prioritise the periodic review backlog.
Mistake impact: Oversight failures let non-compliant or lapsed partners remain active; GDPR register errors create a second, separate regulatory exposure alongside AML risk; quality-control gaps propagate incorrect judgement across the whole analyst team.`,

  MLRO: `Money Laundering Reporting Officer (MLRO) — Senior Second Line
Holds ultimate accountability for Suspicious Activity Report (SAR) submission decisions. Oversees the entire financial crime control framework. Provides Board-level reporting on financial crime risk. Acts as the external-facing contact for regulators and law enforcement. Designs the firm's Financial Crime policy.
Daily activities: Review and make final SAR filing decisions escalated from TM Analysts and DDI Managers; prepare and deliver Board-level MI on financial crime risk; liaise directly with regulators and law enforcement on requests and inspections; design and update financial crime policy; oversee the overall control framework across all lines of defence.
Key decisions: Whether to file a SAR with the regulator, carrying personal criminal liability if wrong; how to characterise financial crime risk to the Board; how to respond to regulator or law enforcement enquiries; where to prioritise control framework investment.
Mistake impact: Wrong SAR decisions carry personal criminal liability; blind spots at this level cascade across every line of defence beneath it; inaccurate Board MI leads to flawed strategic decisions; failures here carry the highest regulatory and reputational exposure of any role in the firm.`,
};

interface EvalRow {
  archetype: string;
  expectedLoD: string;
  classifiedAs: string;
  classificationMatch: boolean;
  confidence: number;
  quality: number | null;
  breakdown: Record<string, number> | null;
  warnings: string[];
  error?: string;
}

async function setupCompany(): Promise<void> {
  const { rows } = await db.query("SELECT id FROM companies WHERE name = 'Eval Harness Company' LIMIT 1");
  if (rows[0]) { TEST_COMPANY_ID = rows[0].id; return; }
  const { rows: inserted } = await db.query(
    "INSERT INTO companies (name, industry, size) VALUES ('Eval Harness Company', 'Banking', '51-200') RETURNING id"
  );
  TEST_COMPANY_ID = inserted[0].id;
}

async function evalArchetype(name: string): Promise<EvalRow> {
  const archetype = ARCHETYPE_MAP[name];
  const description = ROLE_DESCRIPTIONS[name];
  const row: EvalRow = {
    archetype: name,
    expectedLoD: archetype?.line_of_defence ?? '?',
    classifiedAs: '',
    classificationMatch: false,
    confidence: 0,
    quality: null,
    breakdown: null,
    warnings: [],
  };

  try {
    const createRes = await request(app).post('/api/pipeline').send({});
    const planId = createRes.body.planId as string;

    const analyzeRes = await request(app).post(`/api/pipeline/${planId}/analyze-role`).send({ roleDescription: description });
    if (analyzeRes.status !== 200) { row.error = `analyze-role failed: ${JSON.stringify(analyzeRes.body)}`; return row; }
    row.classifiedAs = analyzeRes.body.roleProfile.classified_as;
    row.confidence = analyzeRes.body.roleProfile.classification_confidence;
    row.classificationMatch = row.classifiedAs === name;

    const riskRes = await request(app).post(`/api/pipeline/${planId}/assess-risk`).send({});
    if (riskRes.status !== 200) { row.error = `assess-risk failed: ${JSON.stringify(riskRes.body)}`; return row; }

    const amlrRes = await request(app).post(`/api/pipeline/${planId}/map-amlr`).send({});
    if (amlrRes.status !== 200) { row.error = `map-amlr failed: ${JSON.stringify(amlrRes.body)}`; return row; }

    let rawBody = '';
    await request(app)
      .post(`/api/pipeline/${planId}/generate-plan`)
      .send({})
      .buffer(false)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => { rawBody = Buffer.concat(chunks).toString(); callback(null, rawBody); });
        res.on('error', (e: Error) => callback(e, ''));
      });

    const events = rawBody.split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => { try { return JSON.parse(l.replace('data: ', '')); } catch { return null; } })
      .filter(Boolean);
    const doneEvent = events.find((e: any) => e.type === 'done');
    if (!doneEvent) {
      const errorEvent = events.find((e: any) => e.type === 'error');
      row.error = `generate-plan failed: ${errorEvent?.message ?? 'no done event'}`;
      return row;
    }

    row.quality = doneEvent.quality?.total ?? null;
    row.breakdown = doneEvent.quality
      ? { coverage: doneEvent.quality.coverage, consistency: doneEvent.quality.consistency, citationDepth: doneEvent.quality.citationDepth, coherence: doneEvent.quality.coherence }
      : null;
    row.warnings = doneEvent.quality?.warnings ?? [];
  } catch (err) {
    row.error = String(err);
  }

  return row;
}

async function run() {
  console.log('\n=== Pipeline Quality Eval ===\n');
  await setupCompany();

  const rows: EvalRow[] = [];
  for (const name of Object.keys(ROLE_DESCRIPTIONS)) {
    process.stdout.write(`Running ${name}... `);
    const row = await evalArchetype(name);
    rows.push(row);
    console.log(row.error ? `ERROR: ${row.error}` : `classified=${row.classifiedAs} (${row.classificationMatch ? 'match' : 'MISMATCH'}) quality=${row.quality}`);
  }

  console.log('\n--- Summary ---\n');
  const matched = rows.filter((r) => r.classificationMatch).length;
  const scored = rows.filter((r) => r.quality !== null);
  const meanQuality = scored.length > 0 ? scored.reduce((s, r) => s + (r.quality ?? 0), 0) / scored.length : 0;

  console.table(rows.map((r) => ({
    archetype: r.archetype,
    expectedLoD: r.expectedLoD,
    classified_as: r.classifiedAs || '—',
    match: r.classificationMatch ? '✅' : '❌',
    confidence: r.confidence ? `${Math.round(r.confidence * 100)}%` : '—',
    quality: r.quality ?? '—',
    coverage: r.breakdown?.coverage ?? '—',
    consistency: r.breakdown?.consistency ?? '—',
    citationDepth: r.breakdown?.citationDepth ?? '—',
    coherence: r.breakdown?.coherence ?? '—',
  })));

  for (const r of rows) {
    if (r.warnings.length > 0) console.log(`[${r.archetype}] warnings: ${r.warnings.join('; ')}`);
    if (r.error) console.log(`[${r.archetype}] ERROR: ${r.error}`);
  }

  console.log(`\nClassification accuracy: ${matched}/${rows.length}`);
  console.log(`Mean quality score: ${meanQuality.toFixed(1)}/100\n`);

  await db.query('DELETE FROM training_plans WHERE company_id = $1', [TEST_COMPANY_ID]);
  await db.end();
}

run().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
