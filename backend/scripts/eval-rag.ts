import dotenv from 'dotenv';
dotenv.config();

import { runEvalSuite } from '../src/services/rag/eval';

async function main() {
  console.log('=== RAG Retrieval Evaluation ===\n');
  const summary = await runEvalSuite();

  console.log(`\nTotal queries: ${summary.queries}`);
  console.log(`Mean Precision@5: ${(summary.meanPrecisionAt5 * 100).toFixed(1)}%`);
  console.log(`Mean Recall@5:    ${(summary.meanRecallAt5 * 100).toFixed(1)}%`);
  console.log(`Mean MRR:         ${summary.meanRR.toFixed(3)}`);
  console.log(`Mean Latency:     ${summary.meanLatencyMs.toFixed(0)}ms`);
  console.log(`\n--- Per-Query Details ---\n`);

  for (const d of summary.details) {
    console.log(`[${d.queryId}] ${d.regulation} | ${d.query.slice(0, 60)}...`);
    console.log(`  P@5=${d.precisionAt5.toFixed(2)} R@5=${d.recallAt5.toFixed(2)} MRR=${d.reciprocalRank.toFixed(3)} latency=${d.latencyMs}ms`);
    console.log(`  BM25:${d.bm25Hits} Vec:${d.vectorHits} Articles: [${d.topArticleNumbers.join(', ')}]`);
    console.log('');
  }
}

main().catch(console.error);
