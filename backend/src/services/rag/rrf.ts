// Reciprocal Rank Fusion — combines a BM25 rank map and a vector rank map into
// one ordered id list. Shared by vectorSearch.ts and documentSearch.ts, which
// otherwise query different tables and shape their rows differently.
export function fuseRrf(
  bm25Rank: Map<string, number>,
  vectorRank: Map<string, number>,
  limit = 15,
): string[] {
  const allIds = new Set([...bm25Rank.keys(), ...vectorRank.keys()]);
  const rrfScores: { id: string; rrf: number }[] = [];
  for (const id of allIds) {
    const bRank = bm25Rank.get(id) ?? 9999;
    const vRank = vectorRank.get(id) ?? 9999;
    rrfScores.push({ id, rrf: 1 / (60 + bRank) + 1 / (60 + vRank) });
  }
  rrfScores.sort((a, b) => b.rrf - a.rrf);
  return rrfScores.slice(0, limit).map(x => x.id);
}
