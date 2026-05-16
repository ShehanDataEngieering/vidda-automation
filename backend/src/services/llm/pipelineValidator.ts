import { z } from 'zod';
import type { RiskDimensionScore, AMLRMapping, TrainingPlan, RoleProfileV6 } from '../../types';
import { logger } from '../../utils/logger';

// ===========================================================================
// Zod Schemas — define the exact shape the AI must output at each pipeline step
// These match the JSON schemas in vidda_AI_context_brief.md Sections 6 and 7
// ===========================================================================

// Step 3: A single risk dimension with score and justification
export const RiskDimensionScoreSchema = z.object({
  dimension: z.string(),
  score: z.enum(['Low', 'Medium', 'High', 'Critical']),
  justification: z.string(),
});

// Step 4: One AMLR article mapped to training obligations
// Enforces "Article X" format and validates article is within 9-15 range below
export const AMLRMappingSchema = z.object({
  article: z.string().regex(/^Article \d{1,2}$/, 'Must be "Article X" format'),
  article_name: z.string(),
  applies_because: z.string(),
  training_obligation: z.string(),
});

// Step 5: A single training module in a quarterly plan
// why_included is the explainability field — the jury evaluates this
export const TrainingModulePlanSchema = z.object({
  module_name: z.string(),
  duration_hours: z.number(),
  risk_dimension: z.string(),
  amlr_article: z.string(),
  why_included: z.string(),
});

// Step 5: One quarter with 5-7 modules
export const QuarterSchema = z.object({
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  name: z.string(),
  months: z.string(),
  modules: z.array(TrainingModulePlanSchema),
});

// Step 5: Full 4-quarter training plan
export const TrainingPlanSchema = z.object({
  role_title: z.string(),
  training_philosophy: z.string(),  // "Year 1 builds foundation..." narrative
  quarters: z.array(QuarterSchema).length(4),
});

// Step 2: Role profile extracted by AI from pasted description
export const RoleProfileSchema = z.object({
  role_title: z.string(),
  line_of_defence: z.enum(['1LoD', '2LoD']),
  classified_as: z.string(),
  classification_confidence: z.number().min(0).max(1),
  daily_activities: z.string(),
  key_decisions: z.string(),
  mistake_consequences: z.string(),
});

// ===========================================================================
// Helpers — JSON cleanup and validation
// ===========================================================================

// AI models sometimes wrap JSON in ```json fences — strip those
function cleanupJson(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

// Generic validation result — returns parsed data + warnings (not errors)
// Warnings go to UI so the human can decide; errors block the pipeline
export interface ValidationResult<T> {
  valid: boolean;
  data: T | null;
  warnings: string[];
}

// Step 3 validation — checks all 5 required risk dimensions are present and scored
export function validateRiskMatrix(raw: string): ValidationResult<RiskDimensionScore[]> {
  try {
    const cleaned = cleanupJson(raw);
    const parsed = JSON.parse(cleaned);
    const data = z.array(RiskDimensionScoreSchema).parse(parsed);

    // Semantic checks beyond Zod: count must be 5, all dimensions must be present
    const warnings: string[] = [];
    if (data.length !== 5) warnings.push(`Expected 5 risk dimensions, got ${data.length}`);
    const dims = new Set(data.map(d => d.dimension));
    const required = ['AML Risk', 'Sanctions Risk', 'Fraud Risk', 'Documentation Risk', 'Escalation Risk'];
    for (const d of required) {
      if (!dims.has(d)) warnings.push(`Missing risk dimension: ${d}`);
    }
    return { valid: true, data, warnings };
  } catch (err) {
    logger.warn('Risk matrix validation failed', { error: String(err) });
    return { valid: false, data: null, warnings: ['Failed to parse risk matrix JSON'] };
  }
}

// Step 4 validation — checks no hallucinated articles (must be 9-15)
export function validateAMLRMappings(raw: string): ValidationResult<AMLRMapping[]> {
  try {
    const cleaned = cleanupJson(raw);
    const parsed = JSON.parse(cleaned);
    const data = z.array(AMLRMappingSchema).parse(parsed);
    // Semantic check: articles must be 9-15 (AMLR scope)
    const warnings: string[] = [];
    if (data.length === 0) warnings.push('No AMLR mappings found');
    for (const m of data) {
      const num = parseInt(m.article.replace('Article ', ''), 10);
      if (num < 9 || num > 15) {
        warnings.push(`${m.article} is outside AMLR Articles 9-15 — this may be a hallucination`);
      }
    }
    return { valid: true, data, warnings };
  } catch (err) {
    logger.warn('AMLR mapping validation failed', { error: String(err) });
    return { valid: false, data: null, warnings: ['Failed to parse AMLR mapping JSON'] };
  }
}

// Step 5 validation — checks 4 quarters exist, 5-7 modules each, every module has why_included
export function validateTrainingPlan(raw: string): ValidationResult<TrainingPlan> {
  try {
    const cleaned = cleanupJson(raw);
    const parsed = JSON.parse(cleaned);
    const data = TrainingPlanSchema.parse(parsed);

    // Semantic checks: each quarter should have 5-7 modules, each module must have why_included
    const warnings: string[] = [];
    for (const q of data.quarters) {
      const moduleCount = q.modules.length;
      if (moduleCount < 5 || moduleCount > 7) {
        warnings.push(`${q.quarter} has ${moduleCount} modules (expected 5-7)`);
      }
      for (const m of q.modules) {
        // why_included is the explainability field — the jury's #1 evaluation criterion (25%)
        if (!m.why_included) warnings.push(`${m.module_name} in ${q.quarter} is missing why_included`);
      }
    }
    return { valid: true, data, warnings };
  } catch (err) {
    logger.warn('Training plan validation failed', { error: String(err) });
    return { valid: false, data: null, warnings: ['Failed to parse training plan JSON'] };
  }
}

// Step 2 validation — role profile must have all required fields
export function validateRoleProfile(raw: string): ValidationResult<RoleProfileV6> {
  try {
    const cleaned = cleanupJson(raw);
    const parsed = JSON.parse(cleaned);
    const data = RoleProfileSchema.parse(parsed);
    return { valid: true, data, warnings: [] };
  } catch (err) {
    logger.warn('Role profile validation failed', { error: String(err) });
    return { valid: false, data: null, warnings: ['Failed to parse role profile JSON'] };
  }
}

// Helper to extract cleaned JSON from AI response
export function extractJson(raw: string): string {
  return cleanupJson(raw);
}

// Quick check: is this an AMLR Article 9-15 reference?
export function isValidArticle(value: string): boolean {
  const num = parseInt(value.replace(/Article\s*/i, ''), 10);
  return num >= 9 && num <= 15;
}
