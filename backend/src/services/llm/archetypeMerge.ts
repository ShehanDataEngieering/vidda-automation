import type { TrainingPlan } from '../../types';
import type { RoleArchetype } from './archetypes';

// ===========================================================================
// Merge Logic — reconciles an LLM-generated plan against its role archetype
// When the LLM generates a plan, merge it with the archetype to ensure:
// 1. No High/Critical risk dimension is under-served
// 2. Expected core modules are present
// 3. Every module has a why_included (fallback to archetype if LLM omits)
// ===========================================================================

export interface MergeOptions {
  // If true, inject archetype modules for missing High/Critical dimensions
  ensureCoverage: boolean;
  // If true, fallback to archetype why_included when LLM module lacks one
  fallbackJustification: boolean;
}

export function mergePlanWithArchetype(
  llmPlan: TrainingPlan,
  archetype: RoleArchetype,
  options: MergeOptions = { ensureCoverage: true, fallbackJustification: true },
): TrainingPlan {
  const merged: TrainingPlan = JSON.parse(JSON.stringify(llmPlan));
  const archetypePlan = archetype.plan;

  // Enforce 4 quarters
  while (merged.quarters.length < 4) {
    const qNames = ['Foundation', 'Application', 'Deepening', 'Embedding'];
    const idx = merged.quarters.length;
    merged.quarters.push({
      quarter: `Q${idx + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4',
      name: qNames[idx]!,
      months: `Months ${idx * 3 + 1}–${idx * 3 + 3}`,
      modules: [],
    });
  }

  if (options.ensureCoverage) {
    // Count how many modules address each risk dimension in the LLM plan
    const dimensionCounts: Record<string, number> = {};
    for (const q of merged.quarters) {
      for (const m of q.modules) {
        dimensionCounts[m.risk_dimension] = (dimensionCounts[m.risk_dimension] || 0) + 1;
      }
    }

    // For each High/Critical dimension, ensure at least 2 modules
    for (const riskDim of archetype.risk_matrix) {
      if (riskDim.score === 'High' || riskDim.score === 'Critical') {
        const count = dimensionCounts[riskDim.dimension] || 0;
        if (count < 2) {
          // Find archetype modules for this dimension
          const needed = 2 - count;
          let injected = 0;
          for (const aq of archetypePlan.quarters) {
            for (const am of aq.modules) {
              if (am.risk_dimension === riskDim.dimension && injected < needed) {
                // Inject into the same quarter as archetype, or Q1 if not found
                const targetQ = merged.quarters.find(q => q.quarter === aq.quarter) || merged.quarters[0]!;
                targetQ.modules.push({ ...am, module_name: `${am.module_name} (Archetype)` });
                injected++;
              }
            }
          }
        }
      }
    }
  }

  if (options.fallbackJustification) {
    // Ensure every module has why_included
    for (const q of merged.quarters) {
      for (const m of q.modules) {
        if (!m.why_included || m.why_included.trim().length < 20) {
          // Find matching archetype module by name similarity or dimension
          const fallback = findArchetypeModule(archetypePlan, m.module_name, m.risk_dimension);
          if (fallback) {
            m.why_included = fallback.why_included;
          }
        }
      }
    }
  }

  return merged;
}

function findArchetypeModule(
  plan: TrainingPlan,
  moduleName: string,
  dimension: string,
) {
  // Exact name match first
  for (const q of plan.quarters) {
    for (const m of q.modules) {
      if (m.module_name.toLowerCase() === moduleName.toLowerCase()) return m;
    }
  }
  // Dimension match second
  for (const q of plan.quarters) {
    for (const m of q.modules) {
      if (m.risk_dimension === dimension) return m;
    }
  }
  return null;
}
