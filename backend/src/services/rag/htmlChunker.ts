/**
 * Fetches regulation text from legislation.gov.uk XML API (open, no WAF).
 * legislation.gov.uk retains EU regulations/directives enacted before Brexit.
 *
 * Coverage:
 *  GDPR   — legislation.gov.uk/eur/2016/679        (119 articles)
 *  AML    — legislation.gov.uk/eudr/2018/1673       (AMLD6)
 *  MIFID2 — legislation.gov.uk/eudr/2014/65
 *  DORA   — post-Brexit, not retained → seed.ts falls back to hardcoded chunks
 */

import { parse as parseHtml, HTMLElement } from 'node-html-parser';
import { logger } from '../../utils/logger';

export interface RegulationChunk {
  sectionNumber: string;
  sectionHeading: string | null;
  content: string;
  chunkIndex: number;
}

interface LegislationDoc {
  regulationName: string;
  xmlUrl: string;
}

const LEGISLATION_DOCS: LegislationDoc[] = [
  { regulationName: 'GDPR',   xmlUrl: 'https://www.legislation.gov.uk/eur/2016/679/data.xml' },
  { regulationName: 'AML',    xmlUrl: 'https://www.legislation.gov.uk/eudr/2018/1673/data.xml' },
  { regulationName: 'MIFID2', xmlUrl: 'https://www.legislation.gov.uk/eudr/2014/65/data.xml' },
];

const FETCH_TIMEOUT_MS = 45_000;
const MIN_CHUNK_CHARS = 150;
const MAX_CHUNK_CHARS = 1500;
const OVERLAP_CHARS = 100;

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

function splitIfTooLong(content: string, max: number): string[] {
  if (content.length <= max) return [content];
  const parts: string[] = [];
  let rest = content;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const cutAt = slice.lastIndexOf('. ');
    const at = cutAt > max / 2 ? cutAt + 1 : max;
    parts.push(rest.slice(0, at).trim());
    const restartIdx = Math.max(0, at - OVERLAP_CHARS);
    rest = rest.slice(restartIdx).trim();
  }
  if (rest.length >= MIN_CHUNK_CHARS) parts.push(rest);
  return parts;
}

/**
 * Parse legislation.gov.uk XML.
 * node-html-parser lowercases all tag names — use lowercase selectors.
 * Articles are <P1 id="article-N"> → parsed via .filter() on p1 elements.
 */
function parseLegislationXml(xml: string, regulationName: string): RegulationChunk[] {
  const root = parseHtml(xml, { lowerCaseTagName: false });
  const chunks: RegulationChunk[] = [];
  let chunkIndex = 0;

  // node-html-parser lowercases tag names in querySelectorAll regardless of lowerCaseTagName option
  const allP1 = root.querySelectorAll('p1');
  const articleEls = allP1.filter(el => {
    const id = el.getAttribute('id') ?? '';
    return id.startsWith('article-');
  });

  for (const el of articleEls) {
    const id = el.getAttribute('id') ?? '';
    const rawNum = id.replace('article-', '');
    if (!rawNum) continue;

    // Extract heading (title element inside p1group)
    const titleEl = el.querySelector('p1group title') ?? el.querySelector('title');
    const heading = titleEl ? cleanText(titleEl.text) : null;

    // Clone to strip pnumber and title before extracting content text
    const clone = parseHtml(el.innerHTML);
    clone.querySelectorAll('pnumber, title').forEach((n: HTMLElement) => n.remove());

    const textEls = clone.querySelectorAll('text');
    const lines = textEls.map(t => cleanText(t.text)).filter(t => t.length > 0);
    const content = lines.join(' ');
    if (content.length < MIN_CHUNK_CHARS) continue;

    const parts = splitIfTooLong(content, MAX_CHUNK_CHARS);
    for (let i = 0; i < parts.length; i++) {
      chunks.push({
        sectionNumber: parts.length > 1 ? `${rawNum}.${i + 1}` : rawNum,
        sectionHeading: heading ? `${heading}${i > 0 ? ' (cont.)' : ''}` : null,
        content: parts[i]!,
        chunkIndex: chunkIndex++,
      });
    }
  }

  logger.info(`XML parsed: ${chunks.length} article chunks`, { regulation: regulationName });
  return chunks;
}

async function fetchWithRetry(url: string, attempt = 1): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; compliance-rag/1.0)',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } catch (err) {
    if (attempt < 3) {
      logger.warn(`Fetch attempt ${attempt} failed for ${url}, retrying...`);
      await new Promise(r => setTimeout(r, attempt * 3000));
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

export async function fetchRegulationChunks(regulationName: string): Promise<RegulationChunk[]> {
  const doc = LEGISLATION_DOCS.find(d => d.regulationName === regulationName);
  if (!doc) {
    logger.warn(`No legislation.gov.uk source configured for ${regulationName}`);
    return [];
  }

  logger.info(`Fetching ${regulationName} from legislation.gov.uk...`);
  const xml = await fetchWithRetry(doc.xmlUrl);
  return parseLegislationXml(xml, regulationName);
}

export async function fetchAllRegulations(): Promise<Map<string, RegulationChunk[]>> {
  const result = new Map<string, RegulationChunk[]>();
  for (const doc of LEGISLATION_DOCS) {
    try {
      const chunks = await fetchRegulationChunks(doc.regulationName);
      result.set(doc.regulationName, chunks);
    } catch (err) {
      logger.error(`Failed to fetch ${doc.regulationName}`, { err: String(err) });
      result.set(doc.regulationName, []);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return result;
}
