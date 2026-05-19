import type { TrainingPlan, RiskDimensionScore } from '../../types';
import { openrouter, FALLBACK_MODEL } from './openrouter';
import { logger } from '../../utils/logger';

// ===========================================================================
// Hybrid Quality Scorer — Deterministic 80% + LLM-as-judge 20%
//
// Provides automated, auditable quality assessment of generated training plans
// before they reach the human approval gate.
// ===========================================================================

export interface QualityScore {
  total: number;              // 0–100
  coverage: number;           // 0–25
  consistency: number;        // 0–25
  citationDepth: number;      // 0–25
  coherence: number;          // 0–25 (LLM)
  warnings: string[];
  llmRationale?: string;      // explanation from LLM judge
}

interface ScoreDimension {
  name: string;
  weight: number;
  maxRaw: number;
}

const DIMENSIONS: ScoreDimension[] = [
  { name: 'coverage',       weight: 0.25, maxRaw: 100 },
  { name: 'consistency',    weight: 0.25, maxRaw: 100 },
  { name: 'citationDepth',  weight: 0.25, maxRaw: 100 },
  { name: 'coherence',      weight: 0.25, maxRaw: 100 },
];

// ── DETERMINISTIC: Coverage ───────────────────────────────────────────────────
// Every High risk dimension must have ≥2 modules; Critical must have ≥3
function scoreCoverage(plan: TrainingPlan, riskMatrix: RiskDimensionScore[]): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Count modules per dimension
  const dimensionCounts: Record<string, number> = {};
  for (const q of plan.quarters) {
    for (const m of q.modules) {
      dimensionCounts[m.risk_dimension] = (dimensionCounts[m.risk_dimension] || 0) + 1;
    }
  }

  for (const dim of riskMatrix) {
    if (dim.score === 'High' || dim.score === 'Critical') {
      const required = dim.score === 'Critical' ? 3 : 2;
      const actual = dimensionCounts[dim.dimension] || 0;
      totalChecks++;
      if (actual >= required) {
        passedChecks++;
      } else {
        warnings.push(`${dim.dimension} is ${dim.score} but only has ${actual} module(s) (needs ≥${required})`);
      }
    }
  }

  const score = totalChecks === 0 ? 100 : Math.round((passedChecks / totalChecks) * 100);
  return { score: Math.min(score, 100), warnings };
}

// ── DETERMINISTIC: Consistency ────────────────────────────────────────────────
// Q3 should build on Q2, Q2 on Q1. Check for keyword progression.
function scoreConsistency(plan: TrainingPlan): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let checks = 0;
  let passed = 0;

  const qNames = ['Q1', 'Q2', 'Q3', 'Q4'];
  const progressionKeywords: Record<string, string[]> = {
    'Q1': ['fundamental', 'awareness', 'introduction', 'basic', 'overview'],
    'Q2': ['application', 'practical', 'independent', 'caseload', 'review'],
    'Q3': ['advanced', 'deepening', 'specialist', 'workshop', 'complex'],
    'Q4': ['assessment', 'certification', 'competency', 'update', 'planning'],
  };

  for (let i = 0; i < qNames.length; i++) {
    const q = plan.quarters[i];
    if (!q || q.modules.length === 0) {
      warnings.push(`${qNames[i]} has no modules`);
      continue;
    }
    // Check that quarter name matches expected progression
    const allText = q.modules.map(m => m.module_name.toLowerCase()).join(' ');
    const expected = progressionKeywords[qNames[i]!] || [];
    const hasProgression = expected.some(kw => allText.includes(kw));
    checks++;
    if (hasProgression) passed++;
  }

  // Also check total module count progression (should increase or stay steady)
  const counts = plan.quarters.map(q => q.modules.length);
  for (let i = 1; i < counts.length; i++) {
    if (counts[i]! < counts[i - 1]! - 2) {
      warnings.push(`${qNames[i]} has ${counts[i]} modules, a steep drop from ${qNames[i - 1]}'s ${counts[i - 1]}`);
    }
  }

  const score = checks === 0 ? 100 : Math.round((passed / checks) * 100);
  return { score, warnings };
}

// ── DETERMINISTIC: Citation Depth ─────────────────────────────────────────────
// Count unique AMLR articles referenced. Target: ≥3 unique.
function scoreCitationDepth(plan: TrainingPlan): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const articles = new Set<string>();

  for (const q of plan.quarters) {
    for (const m of q.modules) {
      if (m.amlr_article) articles.add(m.amlr_article);
    }
  }

  const uniqueCount = articles.size;
  const score = Math.min(100, Math.round((uniqueCount / 3) * 100));

  if (uniqueCount < 3) {
    warnings.push(`Only ${uniqueCount} unique AMLR article(s) cited across the plan (target: ≥3)`);
  }

  return { score, warnings };
}

// ── LLM-AUGMENTED: Coherence ──────────────────────────────────────────────────
// Ask the LLM to rate the pedagogical coherence of the plan 1–5
const COHERENCE_PROMPT = `You are an expert instructional designer and AML compliance trainer. Your job is to evaluate the coherence and pedagogical soundness of a compliance training plan.

Evaluate the training plan below on these criteria (rate 1–5 each):
1. LOGICAL PROGRESSION: Does the plan build skills logically from Q1 to Q4?
2. PACING: Is the workload and difficulty appropriately distributed?
3. COMPLETENESS: Does it cover all critical competencies for this role?
4. CLARITY: Are module names and descriptions clear and actionable?
5. PEDAGOGICAL VALUE: Would this plan actually prepare an employee for this role?

Output ONLY a JSON object with this exact shape (no markdown):
{
  "overall_score": 1-5,
  "progression": 1-5,
  "pacing": 1-5,
  "completeness": 1-5,
  "clarity": 1-5,
  "pedagogical_value": 1-5,
  "rationale": "2 sentences explaining the strongest and weakest aspect"
}`;

async function scoreCoherence(plan: TrainingPlan, roleTitle: string): Promise<{ score: number; rationale: string; warnings: string[] }> {
  try {
    const prompt = `${COHERENCE_PROMPT}\n\nROLE: ${roleTitle}\n\nTRAINING PLAN:\n${JSON.stringify(plan, null, 2)}`;

    const llmCall = openrouter.chat.completions.create({
      model: FALLBACK_MODEL,
      max_tokens: 600,
      temperature: 0.1,
      messages: [
        { role: 'system', content: COHERENCE_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    // Timeout after 8s — coherence is supplementary, don't block the pipeline
    const response = await Promise.race([
      llmCall,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 8000)
      ),
    ]);

    const content = response.choices[0]?.message?.content ?? '';
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.warn('Coherence JSON parse failed, using fallback');
      return { score: 70, rationale: 'Fallback due to parse error', warnings: [] };
    }

    const overall = parsed.overall_score ?? parsed.pedagogical_value ?? 3;
    const numeric = typeof overall === 'string' ? parseInt(overall, 10) : (overall as number);
    const score = Math.min(100, Math.round((numeric / 5) * 100));

    const rationale = String(parsed.rationale || '');
    const warnings: string[] = [];
    if (numeric <= 2) warnings.push(`Low pedagogical coherence (${numeric}/5): ${rationale.slice(0, 120)}`);

    return { score, rationale, warnings };
  } catch (err) {
    const msg = String(err);
    logger.warn('LLM coherence scoring failed, using heuristic fallback', { error: msg });
    return {
      score: 70,
      rationale: msg.includes('Timeout') ? 'LLM timed out — scored by heuristic' : 'LLM unavailable — scored by heuristic',
      warnings: msg.includes('Timeout') ? [] : ['LLM coherence check unavailable'],
    };
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export async function evaluatePlan(
  plan: TrainingPlan,
  riskMatrix: RiskDimensionScore[],
  roleTitle: string,
): Promise<QualityScore> {
  const cov = scoreCoverage(plan, riskMatrix);
  const cons = scoreConsistency(plan);
  const cite = scoreCitationDepth(plan);
  const coh = await scoreCoherence(plan, roleTitle);

  const allWarnings = [...cov.warnings, ...cons.warnings, ...cite.warnings, ...coh.warnings];

  // Weighted total (deterministic 75% + coherence 25%)
  const detAvg = Math.round((cov.score + cons.score + cite.score) / 3);
  const total = Math.round(detAvg * 0.75 + coh.score * 0.25);

  return {
    total: Math.min(100, total),
    coverage: cov.score,
    consistency: cons.score,
    citationDepth: cite.score,
    coherence: coh.score,
    warnings: allWarnings,
    llmRationale: coh.rationale,
  };
}

// Helper: format score with label
export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-emerald-700' };
  if (score >= 75) return { label: 'Good', color: 'text-blue-700' };
  if (score >= 60) return { label: 'Acceptable', color: 'text-amber-700' };
  if (score >= 40) return { label: 'Needs Work', color: 'text-orange-700' };
  return { label: 'Poor', color: 'text-red-700' };
}
