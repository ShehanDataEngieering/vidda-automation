// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

export interface RawChunk {
  chunkIndex: number;
  sectionHeading: string | null;
  sectionNumber: string | null;
  pageNumber: number | null;
  content: string;
}

export interface ChildChunk {
  chunkIndex: number;
  parentChunkIndex: number;
  sectionHeading: string | null;
  sectionNumber: string | null;
  pageNumber: number | null;
  content: string;
}

export interface CrossRef {
  sourceChunkIndex: number;
  targetSectionNumber: string;
}

export interface ChunkPdfResult {
  parents: RawChunk[];
  children: ChildChunk[];
  crossRefs: CrossRef[];
}

// Parent: section-level, up to 2000 chars
// Child: paragraph-level within each parent, 400-800 chars
const PARENT_MIN_CHARS = 800;
const PARENT_MAX_CHARS = 2000;
const CHILD_MIN_CHARS = 200;
const CHILD_MAX_CHARS = 800;

const HEADING_PATTERNS = [
  /^\s*(Article|Section|Annex|Schedule|Appendix|Chapter)\s+([\d.]+[a-z]?)\b/i,
  /^\s*(\d+\.\d+(?:\.\d+)?)\s+[A-Z][A-Za-z]/,
  /^\s*(\d+)\.\s+[A-Z][A-Za-z]{3,}/,
];

const CROSS_REF_PATTERNS = [
  /\b(?:see|pursuant to|as defined in|referred to in|in accordance with)\s+(?:Article|Section|Annex)\s+([\d.]+[a-z]?)/gi,
  /\bArticle\s+([\d.]+[a-z]?)\b/g,
  /\bSection\s+([\d.]+[a-z]?)\b/g,
];

function detectHeading(line: string): { heading: string; number: string } | null {
  for (const pattern of HEADING_PATTERNS) {
    const m = line.match(pattern);
    if (m) return { heading: line.trim(), number: m[2] ?? m[1] ?? '' };
  }
  const trimmed = line.trim();
  if (/^[A-Z\s\-–:]{5,60}$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
    return { heading: trimmed, number: '' };
  }
  return null;
}

function splitIntoChildren(
  parent: RawChunk,
  baseChildIndex: number,
): ChildChunk[] {
  const paragraphs = parent.content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const children: ChildChunk[] = [];
  let current = '';
  let childIdx = baseChildIndex;

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;
    if (candidate.length > CHILD_MAX_CHARS && current.length >= CHILD_MIN_CHARS) {
      children.push({
        chunkIndex: childIdx++,
        parentChunkIndex: parent.chunkIndex,
        sectionHeading: parent.sectionHeading,
        sectionNumber: parent.sectionNumber,
        pageNumber: parent.pageNumber,
        content: current.trim(),
      });
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length >= CHILD_MIN_CHARS) {
    children.push({
      chunkIndex: childIdx,
      parentChunkIndex: parent.chunkIndex,
      sectionHeading: parent.sectionHeading,
      sectionNumber: parent.sectionNumber,
      pageNumber: parent.pageNumber,
      content: current.trim(),
    });
  } else if (current.trim() && children.length > 0) {
    // Append to last child rather than drop
    const last = children[children.length - 1];
    if (last) last.content += '\n\n' + current.trim();
  }
  return children;
}

function splitOversizedParent(
  text: string,
  heading: string | null,
  number: string | null,
  page: number | null,
  baseIndex: number,
): RawChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: RawChunk[] = [];
  let current = '';
  let partNum = 0;
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > PARENT_MAX_CHARS && current.length > 0) {
      chunks.push({
        chunkIndex: baseIndex + partNum,
        sectionHeading: partNum === 0 ? heading : heading ? `${heading} (continued)` : null,
        sectionNumber: number,
        pageNumber: page,
        content: current.trim(),
      });
      partNum++;
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) {
    chunks.push({
      chunkIndex: baseIndex + partNum,
      sectionHeading: partNum === 0 ? heading : heading ? `${heading} (continued)` : null,
      sectionNumber: number,
      pageNumber: page,
      content: current.trim(),
    });
  }
  return chunks;
}

export async function chunkPdf(pdfBuffer: Buffer): Promise<ChunkPdfResult> {
  const parsed = await pdfParse(pdfBuffer);
  const pages = parsed.text.split('\f');

  type Section = { heading: string | null; number: string | null; page: number | null; lines: string[] };
  const sections: Section[] = [];
  let currentSection: Section = { heading: null, number: null, page: null, lines: [] };

  pages.forEach((pageText: string, pageIdx: number) => {
    for (const line of pageText.split('\n')) {
      const h = detectHeading(line);
      if (h) {
        if (currentSection.lines.join('\n').trim().length > 0) sections.push(currentSection);
        currentSection = { heading: h.heading, number: h.number || null, page: pageIdx + 1, lines: [] };
      } else {
        currentSection.lines.push(line);
      }
    }
  });
  if (currentSection.lines.join('\n').trim().length > 0) sections.push(currentSection);

  // Build parent chunks (section-level, up to PARENT_MAX_CHARS)
  const parents: RawChunk[] = [];
  let parentIndex = 0;
  let pendingMerge: Section | null = null;

  for (const section of sections) {
    const text = section.lines.join('\n').trim();
    if (!text) continue;

    const toProcess: { heading: string | null; number: string | null; page: number | null; content: string } = pendingMerge
      ? {
          heading: pendingMerge.heading,
          number: pendingMerge.number,
          page: pendingMerge.page,
          content: pendingMerge.lines.join('\n').trim() + '\n\n' + text,
        }
      : { heading: section.heading, number: section.number, page: section.page, content: text };

    pendingMerge = null;

    if (toProcess.content.length < PARENT_MIN_CHARS) {
      pendingMerge = { heading: toProcess.heading, number: toProcess.number, page: toProcess.page, lines: [toProcess.content] };
      continue;
    }

    if (toProcess.content.length > PARENT_MAX_CHARS) {
      const sub = splitOversizedParent(toProcess.content, toProcess.heading, toProcess.number, toProcess.page, parentIndex);
      for (const s of sub) { s.chunkIndex = parentIndex++; parents.push(s); }
    } else {
      parents.push({ chunkIndex: parentIndex++, sectionHeading: toProcess.heading, sectionNumber: toProcess.number, pageNumber: toProcess.page, content: toProcess.content });
    }
  }
  if (pendingMerge) {
    const content = pendingMerge.lines.join('\n').trim();
    if (content) parents.push({ chunkIndex: parentIndex++, sectionHeading: pendingMerge.heading, sectionNumber: pendingMerge.number, pageNumber: pendingMerge.page, content });
  }

  // Build child chunks (paragraph-level within each parent)
  const children: ChildChunk[] = [];
  let childBase = 0;
  for (const parent of parents) {
    const kids = splitIntoChildren(parent, childBase);
    children.push(...kids);
    childBase += kids.length + 1;
  }

  // Cross-reference detection (on parents for stability)
  const sectionNumberToParentIndex = new Map<string, number>();
  for (const p of parents) {
    if (p.sectionNumber) sectionNumberToParentIndex.set(p.sectionNumber.toLowerCase(), p.chunkIndex);
  }

  const crossRefs: CrossRef[] = [];
  const seen = new Set<string>();
  for (const chunk of parents) {
    for (const pattern of CROSS_REF_PATTERNS) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(chunk.content)) !== null) {
        const targetNum = m[1]?.toLowerCase();
        if (!targetNum) continue;
        const targetIdx = sectionNumberToParentIndex.get(targetNum);
        if (targetIdx !== undefined && targetIdx !== chunk.chunkIndex) {
          const key = `${chunk.chunkIndex}:${targetIdx}`;
          if (!seen.has(key)) { seen.add(key); crossRefs.push({ sourceChunkIndex: chunk.chunkIndex, targetSectionNumber: targetNum }); }
        }
      }
    }
  }

  return { parents, children, crossRefs };
}
