import type { QualityResult, SearchResult } from '../types';

function verifyCitationGrounding(content: string, sourceChunks: SearchResult[]): boolean {
  const articleRefs = content.match(/Article\s+[\d\w-]+/gi) ?? [];
  const recommendationRefs = content.match(/Recommendation\s+\d+/gi) ?? [];
  const allRefs = [...articleRefs, ...recommendationRefs];

  if (allRefs.length === 0) return false;

  return allRefs.every(ref => {
    const refNum = ref.replace(/^Article\s+|^Recommendation\s+/i, '').trim();
    return sourceChunks.some(
      c =>
        c.article_reference.includes(refNum) ||
        c.article_number === refNum ||
        c.content.includes(ref)
    );
  });
}

export function scoreModule(
  content: string,
  regulation: string,
  sourceChunks: SearchResult[]
): QualityResult {
  let score = 0;
  const breakdown: Record<string, number> = {};
  const warnings: string[] = [];

  // Check 1: Regulation name present (+20)
  if (content.toLowerCase().includes(regulation.toLowerCase())) {
    score += 20;
    breakdown['Regulation referenced'] = 20;
  } else {
    warnings.push('Regulation name not found in content');
  }

  // Check 2: Article citation present (+20)
  if (/article\s+\d+/i.test(content)) {
    score += 20;
    breakdown['Article citation present'] = 20;
  } else {
    warnings.push('No article reference found');
  }

  // Check 3: Word count 200-600 (+20)
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 200 && wordCount <= 600) {
    score += 20;
    breakdown['Appropriate length'] = 20;
  } else {
    warnings.push(`Word count ${wordCount} outside 200-600 range`);
  }

  // Check 4: OBJECTIVES section (+20)
  if (/OBJECTIVES/i.test(content)) {
    score += 20;
    breakdown['Learning objectives present'] = 20;
  } else {
    warnings.push('No OBJECTIVES section found');
  }

  // Check 5: ASSESSMENT section (+20)
  if (/ASSESSMENT/i.test(content)) {
    score += 20;
    breakdown['Assessment question present'] = 20;
  } else {
    warnings.push('No ASSESSMENT section found');
  }

  // Check 6: Citation grounding (informational — no score penalty)
  const citationGrounded = verifyCitationGrounding(content, sourceChunks);
  if (citationGrounded) {
    breakdown['Citations grounded in source'] = 0;
  } else {
    warnings.push('Some citations could not be verified against source documents');
  }

  return { score, breakdown, citationGrounded, warnings };
}
