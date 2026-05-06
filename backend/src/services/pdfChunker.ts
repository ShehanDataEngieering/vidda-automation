// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

export interface RawChunk {
  chunkIndex: number;
  sectionHeading: string | null;
  sectionNumber: string | null;
  pageNumber: number | null;
  content: string;
}

export interface CrossRef {
  sourceChunkIndex: number;
  targetSectionNumber: string;
}

// ~4 chars per token approximation
const MIN_CHARS = 1200; // ~300 tokens
const MAX_CHARS = 3200; // ~800 tokens

const HEADING_PATTERNS = [
  /^\s*(Article|Section|Annex|Schedule|Appendix|Chapter)\s+([\d.]+[a-z]?)\b/i,
  /^\s*(\d+\.\d+(?:\.\d+)?)\s+[A-Z][A-Za-z]/,
  /^\s*(\d+)\.\s+[A-Z][A-Za-z]{3,}/,
];

// Patterns that look like cross-references inside body text
const CROSS_REF_PATTERNS = [
  /\b(?:see|pursuant to|as defined in|referred to in|in accordance with)\s+(?:Article|Section|Annex)\s+([\d.]+[a-z]?)/gi,
  /\bArticle\s+([\d.]+[a-z]?)\b/g,
  /\bSection\s+([\d.]+[a-z]?)\b/g,
];

function detectHeading(line: string): { heading: string; number: string } | null {
  for (const pattern of HEADING_PATTERNS) {
    const m = line.match(pattern);
    if (m) {
      return {
        heading: line.trim(),
        number: m[2] ?? m[1] ?? '',
      };
    }
  }
  // Short ALL-CAPS line (2-8 words)
  const trimmed = line.trim();
  if (/^[A-Z\s\-–:]{5,60}$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
    return { heading: trimmed, number: '' };
  }
  return null;
}

function splitOversized(text: string, heading: string | null, number: string | null, page: number | null, baseIndex: number): RawChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: RawChunk[] = [];
  let current = '';
  let partNum = 0;

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > MAX_CHARS && current.length > 0) {
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

export async function chunkPdf(pdfBuffer: Buffer): Promise<{ chunks: RawChunk[]; crossRefs: CrossRef[] }> {
  const parsed = await pdfParse(pdfBuffer);
  const pages = parsed.text.split('\f');

  // Pass 1 & 2: collect lines with their page numbers, detect headings, build sections
  type Section = {
    heading: string | null;
    number: string | null;
    page: number | null;
    lines: string[];
  };

  const sections: Section[] = [];
  let currentSection: Section = { heading: null, number: null, page: null, lines: [] };

  pages.forEach((pageText: string, pageIdx: number) => {
    const lines = pageText.split('\n');
    for (const line of lines) {
      const h = detectHeading(line);
      if (h) {
        if (currentSection.lines.join('\n').trim().length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: h.heading,
          number: h.number || null,
          page: pageIdx + 1,
          lines: [],
        };
      } else {
        currentSection.lines.push(line);
      }
    }
  });
  if (currentSection.lines.join('\n').trim().length > 0) {
    sections.push(currentSection);
  }

  // Pass 3: normalize chunk sizes
  const rawChunks: RawChunk[] = [];
  let chunkIndex = 0;
  let pendingMerge: Section | null = null;

  for (const section of sections) {
    const text = section.lines.join('\n').trim();
    if (!text) continue;

    const sectionToProcess: { heading: string | null; number: string | null; page: number | null; content: string } = pendingMerge
      ? {
          heading: pendingMerge.heading,
          number: pendingMerge.number,
          page: pendingMerge.page,
          content: pendingMerge.lines.join('\n').trim() + '\n\n' + text,
        }
      : { heading: section.heading, number: section.number, page: section.page, content: text };

    pendingMerge = null;

    if (sectionToProcess.content.length < MIN_CHARS) {
      // Too small — defer merge with next section
      pendingMerge = {
        heading: sectionToProcess.heading,
        number: sectionToProcess.number,
        page: sectionToProcess.page,
        lines: [sectionToProcess.content],
      };
      continue;
    }

    if (sectionToProcess.content.length > MAX_CHARS) {
      const sub = splitOversized(
        sectionToProcess.content,
        sectionToProcess.heading,
        sectionToProcess.number,
        sectionToProcess.page,
        chunkIndex,
      );
      for (const s of sub) {
        s.chunkIndex = chunkIndex++;
        rawChunks.push(s);
      }
    } else {
      rawChunks.push({
        chunkIndex: chunkIndex++,
        sectionHeading: sectionToProcess.heading,
        sectionNumber: sectionToProcess.number,
        pageNumber: sectionToProcess.page,
        content: sectionToProcess.content,
      });
    }
  }

  // Flush pending merge
  if (pendingMerge) {
    const content = pendingMerge.lines.join('\n').trim();
    if (content) {
      rawChunks.push({
        chunkIndex: chunkIndex++,
        sectionHeading: pendingMerge.heading,
        sectionNumber: pendingMerge.number,
        pageNumber: pendingMerge.page,
        content,
      });
    }
  }

  // Cross-reference detection
  const sectionNumberToChunkIndex = new Map<string, number>();
  for (const chunk of rawChunks) {
    if (chunk.sectionNumber) {
      sectionNumberToChunkIndex.set(chunk.sectionNumber.toLowerCase(), chunk.chunkIndex);
    }
  }

  const crossRefs: CrossRef[] = [];
  const seen = new Set<string>();

  for (const chunk of rawChunks) {
    for (const pattern of CROSS_REF_PATTERNS) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(chunk.content)) !== null) {
        const targetNum = m[1]?.toLowerCase();
        if (!targetNum) continue;
        const targetChunkIdx = sectionNumberToChunkIndex.get(targetNum);
        if (targetChunkIdx !== undefined && targetChunkIdx !== chunk.chunkIndex) {
          const key = `${chunk.chunkIndex}:${targetChunkIdx}`;
          if (!seen.has(key)) {
            seen.add(key);
            crossRefs.push({ sourceChunkIndex: chunk.chunkIndex, targetSectionNumber: targetNum });
          }
        }
      }
    }
  }

  return { chunks: rawChunks, crossRefs };
}
