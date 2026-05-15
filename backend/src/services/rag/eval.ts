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
    relevantArticleNumbers: [],
    expectedAnswerContains: ['data subject', 'access', 'right'],
  },
  {
    id: 'gdpr-2',
    query: 'What are the GDPR requirements for data breach notification?',
    regulation: 'GDPR',
    role: 'IT Security Manager',
    relevantArticleNumbers: [],
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
    id: 'mifid2-1',
    query: 'MiFID II client categorisation requirements',
    regulation: 'MIFID2',
    role: 'Investment Advisor',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['client', 'categorisation', 'retail', 'professional'],
  },
  {
    id: 'mifid2-2',
    query: 'Best execution obligations under MiFID II',
    regulation: 'MIFID2',
    role: 'Trader',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['best execution', 'order', 'client'],
  },
  {
    id: 'dora-1',
    query: 'DORA ICT risk management requirements for financial entities',
    regulation: 'DORA',
    role: 'IT Security Manager',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['ICT', 'risk', 'management', 'digital operational'],
  },
  {
    id: 'kyc-1',
    query: 'What KYC documents are required for corporate clients?',
    regulation: 'KYC',
    role: 'KYC Analyst EDD',
    relevantArticleNumbers: [],
    expectedAnswerContains: ['corporate', 'document', 'identification', 'beneficial'],
  },
];

function computePrecisionAtK(
  retrieved: Array<{ article_number: string }>,
  relevantArticleNumbers: string[],
  k: number = 5,
): number {
  if (retrieved.length === 0 || relevantArticleNumbers.length === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(r =>
    relevantArticleNumbers.some(an =>
      r.article_number.toLowerCase().includes(an.toLowerCase()),
    ),
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
      .map(r => relevantArticleNumbers.find(an =>
        r.article_number.toLowerCase().includes(an.toLowerCase()),
      ))
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
    const match = relevantArticleNumbers.some(an =>
      retrieved[i]!.article_number.toLowerCase().includes(an.toLowerCase()),
    );
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
    results = await searchChunks(query.regulation, query.role, 5);
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
