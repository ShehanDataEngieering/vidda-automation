import { searchChunks } from './vectorSearch';
import { logger } from '../../utils/logger';
import type { SearchResult } from '../../types';

export interface EvalQuery {
  id: string;
  query: string;
  regulation: string;
  role: string;
  relevantArticleNumbers: string[];
  expectedAnswerContains: string[];
}

export interface EvalResult {
  queryId: string;
  query: string;
  regulation: string;
  precisionAt5: number;
  recallAt5: number;
  reciprocalRank: number;
  bm25Hits: number;
  vectorHits: number;
  latencyMs: number;
  topArticleNumbers: string[];
}

export interface EvalSummary {
  queries: number;
  meanPrecisionAt5: number;
  meanRecallAt5: number;
  meanRR: number;
  meanLatencyMs: number;
  details: EvalResult[];
}

const EVAL_QUERIES: EvalQuery[] = [
  // NOTE: the 'AML' regulation tag in this corpus holds Directive (EU) 2018/1673 —
  // the criminal-law directive on money laundering *offences* (definitions, jurisdiction,
  // corporate liability). It contains nothing on customer due diligence, suspicious-transaction
  // reporting, or the MLRO role. That content exists in the DB but is tagged 'KYC' instead
  // (see kyc-1 below), and searchChunks filters strictly by regulation, so these three
  // queries have no correct chunk to retrieve under 'AML' as currently tagged. Left empty
  // deliberately — this is real ground truth (a corpus/tagging gap), not an oversight.
  {
    id: 'aml-1',
    query: 'What are the customer due diligence requirements under AML?',
    regulation: 'AML',
    role: 'KYC Analyst EDD',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['due diligence', 'customer', 'identification'],
  },
  {
    id: 'aml-2',
    query: 'AML suspicious transaction reporting obligations',
    regulation: 'AML',
    role: 'AML DDI Manager',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['suspicious', 'report', 'transaction'],
  },
  {
    id: 'aml-3',
    query: 'What is the role of the Money Laundering Reporting Officer?',
    regulation: 'AML',
    role: 'MLRO',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['reporting officer', 'MLRO', 'money laundering'],
  },
  {
    id: 'gdpr-1',
    query: 'Data subject access rights under GDPR',
    regulation: 'GDPR',
    role: 'Compliance Officer',
    relevantArticleNumbers: ['15'],
    expectedAnswerContains: ['data subject', 'access', 'right'],
  },
  {
    id: 'gdpr-2',
    query: 'What are the GDPR requirements for data breach notification?',
    regulation: 'GDPR',
    role: 'IT Security Manager',
    relevantArticleNumbers: ['33', '34'],
    expectedAnswerContains: ['breach', 'notification', 'supervisory'],
  },
  {
    id: 'gdpr-3',
    query: 'GDPR Article 5 principles relating to processing of personal data',
    regulation: 'GDPR',
    role: 'DPO',
    relevantArticleNumbers: ['5'],
    expectedAnswerContains: ['lawfulness', 'fairness', 'transparency', 'purpose'],
  },
  {
    // The corpus has no dedicated client-categorisation article (that's normally MiFID II
    // Annex II, not present here) — Article 24's general conduct-of-business obligations
    // is the closest available match, so precision/recall here are a lower bar than gdpr-3.
    id: 'mifid2-1',
    query: 'MiFID II client categorisation requirements',
    regulation: 'MIFID2',
    role: 'Investment Advisor',
    relevantArticleNumbers: ['24'],
    expectedAnswerContains: ['client', 'categorisation', 'retail', 'professional'],
  },
  {
    id: 'mifid2-2',
    query: 'Best execution obligations under MiFID II',
    regulation: 'MIFID2',
    role: 'Trader',
    relevantArticleNumbers: ['27'],
    expectedAnswerContains: ['best execution', 'order', 'client'],
  },
  {
    id: 'dora-1',
    query: 'DORA ICT risk management requirements for financial entities',
    regulation: 'DORA',
    role: 'IT Security Manager',
    relevantArticleNumbers: ['5', '6'],
    expectedAnswerContains: ['ICT', 'risk', 'management', 'digital operational'],
  },
  {
    // Only 1 chunk exists under 'KYC' in this corpus (general CDD/beneficial-owner
    // identification, not corporate-specific) — it's the best available match, not a
    // precise one, so a perfect retriever still won't clear a high bar here.
    id: 'kyc-1',
    query: 'What KYC documents are required for corporate clients?',
    regulation: 'KYC',
    role: 'KYC Analyst EDD',
    relevantArticleNumbers: ['13'],
    expectedAnswerContains: ['corporate', 'document', 'identification', 'beneficial'],
  },
  // AMLR queries — this is the regulation the live pipeline actually queries
  // (backend/src/routes/pipeline.ts calls searchChunks('AMLR', ...)); the queries above
  // exercise the general RAG corpus but never touch the code path the app depends on.
  {
    id: 'amlr-1',
    query: 'What customer due diligence measures must obliged entities apply under AMLR?',
    regulation: 'AMLR',
    role: 'Compliance Officer',
    relevantArticleNumbers: ['10a', '10b'],
    expectedAnswerContains: ['due diligence', 'customer', 'identify'],
  },
  {
    id: 'amlr-2',
    query: 'What training must obliged entities provide employees on money laundering prevention under AMLR?',
    regulation: 'AMLR',
    role: 'Training Manager',
    relevantArticleNumbers: ['12a', '12b', '12c'],
    expectedAnswerContains: ['training', 'employee', 'money laundering'],
  },
  {
    id: 'amlr-3',
    query: 'How long must obliged entities retain records under AMLR?',
    regulation: 'AMLR',
    role: 'Compliance Officer',
    relevantArticleNumbers: ['14'],
    expectedAnswerContains: ['record', 'retain'],
  },
];

// Treats "5.1"/"5.2" as belonging to article "5", but rejects unrelated numbers that
// merely contain the same digits as a substring (e.g. "15.1", "50", "25.1" vs relevant "5").
function articleMatches(articleNumber: string, relevantNumber: string): boolean {
  const a = articleNumber.trim().toLowerCase();
  const r = relevantNumber.trim().toLowerCase();
  return a === r || a.startsWith(`${r}.`);
}

function computePrecisionAtK(
  retrieved: Array<{ article_number: string }>,
  relevantArticleNumbers: string[],
  k: number = 5,
): number {
  if (retrieved.length === 0 || relevantArticleNumbers.length === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(r =>
    relevantArticleNumbers.some(an => articleMatches(r.article_number, an)),
  );
  return relevant.length / Math.min(k, topK.length);
}

function computeRecallAtK(
  retrieved: Array<{ article_number: string }>,
  relevantArticleNumbers: string[],
  k: number = 5,
): number {
  if (retrieved.length === 0 || relevantArticleNumbers.length === 0) return 0;
  const topK = retrieved.slice(0, k);
  const found = new Set(
    topK
      .map(r => relevantArticleNumbers.find(an => articleMatches(r.article_number, an)))
      .filter(Boolean),
  );
  return found.size / relevantArticleNumbers.length;
}

function computeReciprocalRank(
  retrieved: Array<{ article_number: string }>,
  relevantArticleNumbers: string[],
): number {
  if (retrieved.length === 0 || relevantArticleNumbers.length === 0) return 0;
  for (let i = 0; i < retrieved.length; i++) {
    const match = relevantArticleNumbers.some(an => articleMatches(retrieved[i]!.article_number, an));
    if (match) return 1 / (i + 1);
  }
  return 0;
}

export async function evaluateRetrieval(
  query: EvalQuery,
): Promise<EvalResult> {
  const start = Date.now();
  let results: SearchResult[] = [];
  let bm25Count = 0;
  let vecCount = 0;

  try {
    results = await searchChunks(query.regulation, query.role, 5, query.query);
  } catch (err) {
    logger.warn('Eval query failed', { queryId: query.id, error: String(err) });
  }

  const latencyMs = Date.now() - start;

  // Count how many had bm25 vs vector origins
  bm25Count = results.filter(r => r.bm25Score > 0).length;
  vecCount = results.filter(r => r.finalScore > 0).length;

  const precisionAt5 = computePrecisionAtK(results, query.relevantArticleNumbers, 5);
  const recallAt5 = computeRecallAtK(results, query.relevantArticleNumbers, 5);
  const reciprocalRank = computeReciprocalRank(results, query.relevantArticleNumbers);

  return {
    queryId: query.id,
    query: query.query,
    regulation: query.regulation,
    precisionAt5,
    recallAt5,
    reciprocalRank,
    bm25Hits: bm25Count,
    vectorHits: vecCount,
    latencyMs,
    topArticleNumbers: results.slice(0, 5).map(r => r.article_number),
  };
}

export async function runEvalSuite(queries: EvalQuery[] = EVAL_QUERIES): Promise<EvalSummary> {
  logger.info(`Running RAG evaluation suite with ${queries.length} queries...`);
  const details: EvalResult[] = [];

  for (const q of queries) {
    const result = await evaluateRetrieval(q);
    details.push(result);
  }

  const validDetails = details.filter(d => d.precisionAt5 >= 0);
  const meanPrecision = validDetails.length > 0
    ? validDetails.reduce((s, d) => s + d.precisionAt5, 0) / validDetails.length
    : 0;
  const meanRecall = validDetails.length > 0
    ? validDetails.reduce((s, d) => s + d.recallAt5, 0) / validDetails.length
    : 0;
  const meanRR = validDetails.length > 0
    ? validDetails.reduce((s, d) => s + d.reciprocalRank, 0) / validDetails.length
    : 0;
  const meanLatency = validDetails.length > 0
    ? validDetails.reduce((s, d) => s + d.latencyMs, 0) / validDetails.length
    : 0;

  const summary: EvalSummary = {
    queries: details.length,
    meanPrecisionAt5: meanPrecision,
    meanRecallAt5: meanRecall,
    meanRR,
    meanLatencyMs: meanLatency,
    details,
  };

  logger.info('RAG evaluation complete');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

export { EVAL_QUERIES };
