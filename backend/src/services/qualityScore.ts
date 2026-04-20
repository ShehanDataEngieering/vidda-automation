/**
 * Scores a generated training module against a five-point rubric (0–100).
 * Each criterion is worth 20 points. The rubric is intentionally lightweight —
 * it checks structural completeness and citation presence, not semantic quality.
 * Semantic review is left to the human reviewer in Week 2.
 */
export function scoreModule(content: string, regulationName: string): number {
  let score = 0;

  // Ensures the module is actually about the target regulation
  if (content.includes(regulationName)) score += 20;

  // Claude's system prompt requires citations; this confirms the format was followed
  if (/Article\s+\d+/i.test(content)) score += 20;

  // 200–500 words: long enough to be substantive, short enough to be consumable
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 200 && wordCount <= 500) score += 20;

  // Structural sections required by the system prompt
  if (content.includes('OBJECTIVES')) score += 20;
  if (content.includes('ASSESSMENT')) score += 20;

  return score;
}
