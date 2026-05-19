import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../db/client';
import { chunkPdf } from '../../services/pdf/chunker';
import { embedTexts } from '../../services/rag/embeddings';
import { logger } from '../../utils/logger';

// ===========================================================================
// Seed AMLR 2024/1624 Articles 9-15 into regulatory_chunks
// Optimised retrieval: ~12 paragraph-level chunks instead of 7 monolithic ones
// ===========================================================================

const PDF_PATH = path.join(__dirname, 'data', 'amlr-2024-1624.pdf');

// Each article split into focused, overlapping sub-chunks for better retrieval
// Key metric: each chunk answers a specific query intent (e.g. "training", "records", "cdd")
const AMLR_CHUNKS: Array<{
  articleNumber: string;        // unique DB key (e.g. '9a', '12b')
  articleReference: string;     // human label (e.g. 'AMLR Article 12 — Training programmes')
  content: string;
}> = [
  // ── Article 9 ──
  {
    articleNumber: '9a',
    articleReference: 'AMLR Article 9 — Scope of internal policies',
    content: `Article 9 — Scope of internal policies, procedures and controls

1. Obliged entities shall establish and maintain internal policies, controls and procedures that are proportionate to their nature and size and that effectively mitigate and manage the risks of money laundering and terrorist financing identified at the Union, Member State and entity level.

2. Those policies, controls and procedures shall include at least:
(a) customer due diligence in accordance with Chapter III;
(b) reporting obligations in accordance with Articles 50 and 51;
(c) record-keeping in accordance with Article 54;
(d) internal control, compliance management and screening procedures in accordance with Article 11;
(e) measures to ensure the integrity of employees in accordance with Article 13;
(f) training of employees in accordance with Article 12.`,
  },
  {
    articleNumber: '9b',
    articleReference: 'AMLR Article 9 — Third-country branches',
    content: `Article 9 (continued)

3. Obliged entities shall communicate their internal policies, controls and procedures to their branches and majority-owned subsidiaries operating in third countries. Where a third country's AML/CFT requirements are less strict than those of the Union, obliged entities shall ensure that their branches and majority-owned subsidiaries apply measures equivalent to those required under this Regulation.`,
  },

  // ── Article 10 ──
  {
    articleNumber: '10a',
    articleReference: 'AMLR Article 10 — Customer due diligence (measures a–d)',
    content: `Article 10 — Customer due diligence measures

1. For the purpose of conducting customer due diligence, obliged entities shall apply all of the following measures:
(a) identifying the customer and verifying the customer's identity;
(b) identifying the beneficial owners and taking reasonable measures to verify their identity so that the obliged entity is satisfied that it knows who the beneficial owner is and that it understands the ownership and control structure of the customer;
(c) assessing and, as appropriate, obtaining information on and understanding the purpose and intended nature of the business relationship or the occasional transactions;
(d) verifying whether the customer or the beneficial owners are subject to targeted financial sanctions.`,
  },
  {
    articleNumber: '10b',
    articleReference: 'AMLR Article 10 — Customer due diligence (measures e–i)',
    content: `Article 10 (continued)

(e) assessing and, as appropriate, obtaining information on the nature of the customers' business, including whether they carry out activities, or of their employment or occupation;
(f) conducting ongoing monitoring of the business relationship including scrutiny of transactions to ensure they are consistent with the obliged entity's knowledge of the customer, the business and risk profile, including where necessary the source of funds;
(g) determining whether the customer, the beneficial owner and, where relevant, the person on whose behalf a transaction is being carried out is a politically exposed person, a family member or person known to be a close associate;
(h) where a transaction is being conducted on behalf of natural persons other than the customer, identifying and verifying the identity of those natural persons;
(i) verifying that any person purporting to act on behalf of the customer is so authorised and identify and verify their identity.`,
  },

  // ── Article 11 ──
  {
    articleNumber: '11',
    articleReference: 'AMLR Article 11 — Compliance functions',
    content: `Article 11 — Compliance functions

1. Obliged entities shall appoint one member of the management body or a member of the senior management who shall be responsible for the implementation of the AML/CFT policies, controls and procedures (the "compliance officer").

2. The compliance officer shall have sufficient resources, including staff, technology and budget, to carry out their functions effectively.

3. The compliance officer shall report directly to the management body in its management function and shall not be unduly influenced by commercial interests.

4. The compliance officer shall have access to all information, data, records and premises necessary for the performance of their duties.

5. The compliance officer may also serve as the MLRO, provided the obliged entity meets the conditions specified in Article 12 of Directive (EU) 2015/849.`,
  },

  // ── Article 12 — THE CORE TRAINING ARTICLE ──
  {
    articleNumber: '12a',
    articleReference: 'AMLR Article 12 — Awareness of requirements',
    content: `Article 12 — Awareness of requirements and training of employees

1. Obliged entities shall take appropriate measures to ensure that their employees are aware of the provisions of this Regulation, including the requirements relating to data protection.`,
  },
  {
    articleNumber: '12b',
    articleReference: 'AMLR Article 12 — Training programmes',
    content: `Article 12 (continued)

2. Obliged entities shall ensure that their employees participate in specific, ongoing training programmes to identify activities that may be related to money laundering or terrorist financing and to instruct them as to how to proceed in such cases.

3. The training referred to in paragraph 2 shall be appropriate to the functions or activities of the employees, and shall take into account the money laundering and terrorist financing risks to which the obliged entity is exposed.

4. Obliged entities shall maintain records of the training provided to their employees.`,
  },
  {
    articleNumber: '12c',
    articleReference: 'AMLR Article 12 — Training updates and typologies',
    content: `Article 12 (continued)

5. The training programmes shall be updated regularly to take account of new developments, including new money laundering and terrorist financing typologies.`,
  },

  // ── Article 13 ──
  {
    articleNumber: '13a',
    articleReference: 'AMLR Article 13 — Skills and integrity assessments',
    content: `Article 13 — Integrity of employees

1. Any employee, or person in a comparable position, including agents and distributors, directly participating in the obliged entity's compliance with this Regulation, Regulation (EU) 2023/1113 and any administrative act issued by any supervisor, shall undergo an assessment commensurate with the risks associated with the tasks performed and whose content is approved by the compliance officer of:
(a) individual skills, knowledge and expertise to carry out their functions effectively;
(b) good repute, honesty and integrity.`,
  },
  {
    articleNumber: '13b',
    articleReference: 'AMLR Article 13 — Frequency of assessments',
    content: `Article 13 (continued)

The assessment shall be performed prior to taking up of activities by the employee and shall be regularly repeated. The intensity of the subsequent assessments shall be determined on the basis of the tasks entrusted to the person and risks associated with the function they perform.`,
  },

  // ── Article 14 ──
  {
    articleNumber: '14',
    articleReference: 'AMLR Article 14 — Record-keeping',
    content: `Article 14 — Record-keeping

1. Obliged entities shall retain the documents and information that are necessary to prevent, detect and investigate money laundering and terrorist financing.

2. The retention period shall be five years from the end of the business relationship or the date of the occasional transaction. Member States may provide for a longer retention period.`,
  },

  // ── Article 15 ──
  {
    articleNumber: '15',
    articleReference: 'AMLR Article 15 — Data protection',
    content: `Article 15 — Data protection

1. The processing of personal data under this Regulation shall be subject to Regulation (EU) 2016/679 (GDPR).

2. Personal data shall only be processed by obliged entities for the purposes of preventing money laundering and terrorist financing and shall not be further processed in a way incompatible with those purposes.`,
  },
];

async function main() {
  logger.info('Seeding enhanced AMLR 2024/1624 chunks...');

  // Clear existing AMLR chunks to allow re-seeding with new granularity
  await db.query(`DELETE FROM regulatory_chunks WHERE regulation = 'AMLR'`);
  logger.info('Cleared existing AMLR chunks.');

  // Build text list
  const texts = AMLR_CHUNKS.map(c => c.content);
  logger.info(`Embedding ${texts.length} AMLR chunks...`);

  const embeddings = await embedTexts(texts);

  let inserted = 0;
  for (let i = 0; i < AMLR_CHUNKS.length; i++) {
    const chunk = AMLR_CHUNKS[i]!;
    const emb = embeddings[i];
    if (!emb || emb.length === 0) continue;

    await db.query(
      `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, content, embedding)
       VALUES ('AMLR', $1, $2, $3, $4::vector)
       ON CONFLICT (regulation, article_number) DO UPDATE
       SET content = $3, embedding = $4::vector`,
      [chunk.articleNumber, chunk.articleReference, chunk.content, `[${emb.join(',')}]`],
    );
    inserted++;
  }

  // Verify
  const { rows: verify } = await db.query(
    `SELECT article_number, article_reference, LEFT(content, 60) as preview
     FROM regulatory_chunks WHERE regulation = 'AMLR' ORDER BY article_number`,
  );

  logger.info(`AMLR seed complete. ${inserted}/${AMLR_CHUNKS.length} chunks loaded:`);
  for (const r of verify) {
    logger.info(`  ${r.article_number}: ${r.article_reference} — ${r.preview}...`);
  }
}

main().catch(err => {
  logger.error('AMLR seed failed', { error: String(err) });
  process.exit(1);
});
