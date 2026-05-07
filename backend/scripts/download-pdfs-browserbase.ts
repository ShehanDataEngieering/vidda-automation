/**
 * Downloads EUR-Lex compliance PDFs using Browserbase (cloud browser).
 * Bypasses CloudFront WAF that blocks direct curl requests.
 *
 * Usage:
 *   BROWSERBASE_API_KEY=... BROWSERBASE_PROJECT_ID=... npx ts-node scripts/download-pdfs-browserbase.ts
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
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.connectOverCDP>>['newPage']>>,
  pdf: { name: string; url: string },
): Promise<void> {
  console.log(`  Navigating to ${pdf.name}...`);

  // Use response interception to capture the PDF bytes
  const responsePromise = page.waitForResponse(
    r => r.url().includes('CELEX') && r.status() === 200,
    { timeout: 60_000 },
  );

  await page.goto(pdf.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  let bytes: Buffer | null = null;

  try {
    const response = await responsePromise;
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('pdf')) {
      bytes = Buffer.from(await response.body());
      console.log(`  Captured via response interception (${bytes.length} bytes)`);
    }
  } catch {
    // fallback: fetch directly from page context using browser cookies
  }

  if (!bytes) {
    console.log(`  Falling back to in-page fetch...`);
    const base64 = await page.evaluate(async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    }, pdf.url);
    bytes = Buffer.from(base64, 'base64');
    console.log(`  Fetched via in-page fetch (${bytes.length} bytes)`);
  }

  if (bytes.length < 1000) {
    throw new Error(`PDF too small (${bytes.length} bytes) — likely an error page`);
  }

  const outPath = path.join(OUT_DIR, pdf.name);
  fs.writeFileSync(outPath, bytes);
  console.log(`  ✅ Saved ${pdf.name} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bb = new Browserbase({ apiKey: API_KEY });

  console.log('Creating Browserbase session...');
  const session = await bb.sessions.create({ projectId: PROJECT_ID });
  console.log(`Session ID: ${session.id}`);

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  let failed = 0;
  for (const pdf of PDFS) {
    const existing = path.join(OUT_DIR, pdf.name);
    if (fs.existsSync(existing) && fs.statSync(existing).size > 10_000) {
      console.log(`  [skip] ${pdf.name} already downloaded`);
      continue;
    }
    try {
      await downloadPdf(page, pdf);
    } catch (err) {
      console.error(`  ❌ Failed ${pdf.name}: ${err}`);
      failed++;
    }
    // Brief pause between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  console.log('\nDone. Files in', OUT_DIR);
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.pdf'));
  for (const f of files) {
    const size = fs.statSync(path.join(OUT_DIR, f)).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(0)} KB`);
  }

  if (failed > 0) {
    console.error(`\n${failed} PDF(s) failed — check errors above`);
    process.exit(1);
  }

  console.log('\nNow run: npm run seed');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
