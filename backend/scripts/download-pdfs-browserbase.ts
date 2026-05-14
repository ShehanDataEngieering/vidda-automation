/**
 * Downloads EUR-Lex compliance PDFs using Browserbase (cloud browser).
 * Bypasses CloudFront WAF that blocks direct curl requests.
 *
 * Usage: npm run download-pdfs
 * Requires BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID in .env
 */

import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.BROWSERBASE_API_KEY ?? '';
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID ?? '';

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID in .env');
  process.exit(1);
}

const PDFS = [
  { name: 'gdpr.pdf',   url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679' },
  { name: 'amld6.pdf',  url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32018L1673' },
  { name: 'dora.pdf',   url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022R2554' },
  { name: 'mifid2.pdf', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32014L0065' },
];

const OUT_DIR = path.join(__dirname, '../src/db/pdfs');

async function downloadPdf(
  browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>,
  pdf: { name: string; url: string },
): Promise<void> {
  const outPath = path.join(OUT_DIR, pdf.name);
  console.log(`  Downloading ${pdf.name}...`);

  // Fresh context + page per PDF — isolates cookies/state
  const context = await browser.newContext();
  const page = await context.newPage();

  // Use wrapper object — avoids TypeScript narrowing capturedBytes to 'never'
  // inside async route callbacks
  const captured = { bytes: Buffer.alloc(0) };

  try {
    // Intercept ALL responses — catch the PDF regardless of redirects
    await page.route('**/*', async (route) => {
      let response;
      try {
        response = await route.fetch();
      } catch {
        await route.continue();
        return;
      }

      const ct = (response.headers()['content-type'] ?? '').toLowerCase();
      const cd = (response.headers()['content-disposition'] ?? '').toLowerCase();
      const isPdf = ct.includes('pdf') || cd.includes('.pdf') || cd.includes('attachment');

      if (isPdf && captured.bytes.length === 0) {
        try {
          const body = await response.body();
          if (body.length > 0) {
            captured.bytes = Buffer.from(body);
            console.log(`  Intercepted PDF: ${captured.bytes.length} bytes`);
          }
        } catch { /* body read failed */ }
      }

      // Strip Content-Disposition so the browser doesn't treat it as a download
      try {
        const headers = { ...response.headers() };
        delete headers['content-disposition'];
        await route.fulfill({
          status: response.status(),
          headers,
          body: await response.body().catch(() => Buffer.alloc(0)),
        });
      } catch {
        await route.continue();
      }
    });

    await page.goto(pdf.url, { waitUntil: 'load', timeout: 120_000 }).catch(() => {});

    // Fallback: if interception missed it, fetch from page context using session cookies
    if (captured.bytes.length < 5_000) {
      console.log(`  Trying in-page fetch fallback...`);
      const base64: string = await page.evaluate(async (url: string) => {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const u8 = new Uint8Array(buf);
        let str = '';
        const CHUNK = 8192;
        for (let i = 0; i < u8.length; i += CHUNK) {
          str += String.fromCharCode(...u8.subarray(i, i + CHUNK));
        }
        return btoa(str);
      }, pdf.url);
      captured.bytes = Buffer.from(base64, 'base64');
      console.log(`  In-page fetch: ${captured.bytes.length} bytes`);
    }

    if (captured.bytes.length < 5_000) {
      throw new Error(`PDF too small (${captured.bytes.length} bytes) — EUR-Lex may be blocking`);
    }

    fs.writeFileSync(outPath, captured.bytes);
    console.log(`  ✅ ${pdf.name} — ${(captured.bytes.length / 1024).toFixed(0)} KB`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bb = new Browserbase({ apiKey: API_KEY });

  console.log('Creating Browserbase session...');
  const session = await bb.sessions.create({ projectId: PROJECT_ID });
  console.log(`Session ID: ${session.id}\n`);

  const browser = await chromium.connectOverCDP(session.connectUrl);

  let failed = 0;
  for (const pdf of PDFS) {
    const existing = path.join(OUT_DIR, pdf.name);
    if (fs.existsSync(existing) && fs.statSync(existing).size > 10_000) {
      console.log(`  [skip] ${pdf.name} already exists`);
      continue;
    }
    try {
      await downloadPdf(browser, pdf);
    } catch (err) {
      console.error(`  ❌ ${pdf.name}: ${err}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  await browser.close().catch(() => {});

  console.log('\nFiles in', OUT_DIR);
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.pdf'));
  for (const f of files) {
    const size = fs.statSync(path.join(OUT_DIR, f)).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(0)} KB`);
  }

  if (failed > 0) {
    console.error(`\n${failed} PDF(s) failed`);
    process.exit(1);
  }
  console.log('\nRun next: npm run seed');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
