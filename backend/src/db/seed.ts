import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { chunkPdf } from '../services/pdfChunker';
import { embedTexts } from '../services/embeddings';

dotenv.config();

const db = new Pool({ connectionString: process.env['DATABASE_URL'] });

// Filename → regulation code mapping
const PDF_REGULATION_MAP: Record<string, string> = {
  'gdpr.pdf': 'GDPR',
  'amld6.pdf': 'AML',
  'aml.pdf': 'AML',
  'dora.pdf': 'DORA',
  'mifid2.pdf': 'MIFID2',
  'mifid-ii.pdf': 'MIFID2',
  'kyc-eba.pdf': 'KYC',
  'kyc.pdf': 'KYC',
};

const SEED_CHUNKS = [
  { regulation: 'AML', article_number: 'FATF-10', article_reference: 'FATF Recommendation 10',
    entities: ['customer due diligence', 'CDD', 'anonymous accounts', 'beneficial owner', 'business relationship'],
    content: `Financial institutions should be prohibited from keeping anonymous accounts or accounts in obviously fictitious names. Financial institutions should be required to undertake customer due diligence (CDD) measures when: establishing business relations; carrying out occasional transactions above EUR 15,000; there is a suspicion of money laundering or terrorist financing regardless of threshold. CDD measures include: identifying the customer and verifying their identity using reliable, independent source documents; identifying the beneficial owner and verifying their identity; understanding the purpose and intended nature of the business relationship.` },
  { regulation: 'AML', article_number: '7', article_reference: 'AMLD6 Article 7',
    entities: ['obliged entities', 'customer due diligence', 'EUR 10000', 'money laundering', 'terrorist financing'],
    content: `Member States shall require obliged entities to apply customer due diligence measures in the following circumstances: when establishing a business relationship; when carrying out an occasional transaction that amounts to EUR 10,000 or more, whether the transaction is carried out in a single operation or in several operations which appear to be linked; when carrying out an occasional transfer of funds exceeding EUR 1,000; when there is a suspicion of money laundering or terrorist financing, regardless of any derogation, exemption or threshold.` },
  { regulation: 'AML', article_number: '11', article_reference: 'AMLR 2024/1624 Article 11',
    entities: ['training', 'employees', 'role-specific', 'competence', 'documentation', 'AML responsibility'],
    content: `Obliged entities shall take measures to make their employees aware of the provisions adopted pursuant to this Regulation. These measures shall include participation of relevant employees in special training programmes to help them recognise operations which may be related to money laundering or terrorist financing and to instruct them as to how to proceed in such cases. Role-specific training must be documented and competence must be demonstrable per role.` },
  { regulation: 'AML', article_number: '13', article_reference: 'AMLD6 Article 13',
    entities: ['enhanced due diligence', 'high-risk', 'PEP', 'politically exposed person', 'higher risk'],
    content: `Member States shall require obliged entities to apply enhanced customer due diligence measures in situations which by their nature can present a higher risk of money laundering or terrorist financing. Politically exposed persons (PEPs) shall always be subject to enhanced due diligence measures including senior management approval for establishing business relationships.` },
  { regulation: 'AML', article_number: 'EBA-2020', article_reference: 'EBA AML Guidelines 2020 Section 4',
    entities: ['training', 'staff', 'senior management', 'role-specific', 'ML TF risk', 'policies procedures'],
    content: `Firms should train all relevant staff, including senior management, on ML/TF risks, the firm's AML/CFT policies, procedures and controls, and their specific responsibilities. Training should be role-specific: front office staff require different training content than compliance officers or onboarding teams. Effectiveness of training should be assessed and documented.` },
  { regulation: 'KYC', article_number: '13', article_reference: 'AMLD5 Article 13',
    entities: ['customer due diligence', 'identity verification', 'beneficial owner', 'business relationship'],
    content: `Customer due diligence measures shall comprise: identifying the customer and verifying the customer's identity on the basis of documents, data or information obtained from a reliable and independent source; identifying the beneficial owner and taking reasonable measures to verify that person's identity; assessing and, as appropriate, obtaining information on the purpose and intended nature of the business relationship; conducting ongoing monitoring of the business relationship.` },
  { regulation: 'KYC', article_number: '12', article_reference: 'FATF Recommendation 12',
    entities: ['politically exposed person', 'PEP', 'enhanced due diligence', 'senior management approval'],
    content: `Financial institutions should apply enhanced due diligence measures for politically exposed persons including: obtaining senior management approval for establishing or continuing business relationships; taking reasonable measures to establish the source of wealth and source of funds; conducting enhanced ongoing monitoring of the business relationship.` },
  { regulation: 'KYC', article_number: 'EBA-CDD', article_reference: 'EBA Guidelines on CDD 2022',
    entities: ['CDD process', 'records', 'training', 'role-specific', 'escalation'],
    content: `Firms should document their customer due diligence process and maintain records of the evidence obtained for a minimum of five years after the business relationship ends. Staff responsible for CDD should receive role-specific training on the firm's CDD policies and procedures, including how to identify and escalate unusual patterns of behaviour or transactions.` },
  { regulation: 'GDPR', article_number: '5', article_reference: 'GDPR Article 5',
    entities: ['personal data', 'lawful processing', 'purpose limitation', 'data minimisation', 'transparency'],
    content: `Personal data shall be: processed lawfully, fairly and in a transparent manner; collected for specified, explicit and legitimate purposes; adequate, relevant and limited to what is necessary (data minimisation); accurate and kept up to date; kept in a form which permits identification of data subjects for no longer than necessary; processed in a manner that ensures appropriate security of the personal data.` },
  { regulation: 'GDPR', article_number: '17', article_reference: 'GDPR Article 17',
    entities: ['right to erasure', 'right to be forgotten', 'data deletion', 'retention'],
    content: `The data subject shall have the right to obtain from the controller the erasure of personal data without undue delay where: the personal data are no longer necessary; the data subject withdraws consent; the data subject objects to the processing; the personal data have been unlawfully processed.` },
  { regulation: 'GDPR', article_number: '32', article_reference: 'GDPR Article 32',
    entities: ['security measures', 'encryption', 'pseudonymisation', 'data breach', 'technical organisational measures'],
    content: `The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including: pseudonymisation and encryption of personal data; the ability to ensure ongoing confidentiality, integrity, availability and resilience of processing systems; the ability to restore availability and access to personal data in a timely manner in the event of an incident.` },
  { regulation: 'GDPR', article_number: '83', article_reference: 'GDPR Article 83',
    entities: ['administrative fines', 'EUR 20 million', '4% global turnover', 'penalties'],
    content: `Infringements shall be subject to administrative fines up to EUR 20,000,000, or in the case of an undertaking, up to 4% of the total worldwide annual turnover of the preceding financial year, whichever is higher. Supervisory authorities shall ensure that the imposition of administrative fines is effective, proportionate and dissuasive.` },
  { regulation: 'DORA', article_number: '5', article_reference: 'DORA Article 5',
    entities: ['ICT risk management', 'digital operational resilience', 'ICT assets', 'strategies policies procedures'],
    content: `Financial entities shall have in place a comprehensive ICT risk management framework which allows them to address ICT risk quickly, efficiently and comprehensively. The framework shall include strategies, policies, procedures, ICT protocols and tools necessary to protect all information assets and ICT assets. Financial entities shall continuously improve their digital operational resilience on the basis of lessons derived from ICT-related incidents.` },
  { regulation: 'DORA', article_number: '13', article_reference: 'DORA Article 13',
    entities: ['ICT security', 'availability', 'authenticity', 'integrity', 'confidentiality', 'resilience'],
    content: `Financial entities shall develop, acquire and implement ICT security policies, procedures, protocols and tools that aim to ensure the resilience, continuity and availability of ICT systems. Measures shall maintain high standards of availability, authenticity, integrity and confidentiality of data at rest and in transit. IT Teams and Risk Officers shall receive specific training on ICT risk management obligations under DORA.` },
  { regulation: 'MIFID2', article_number: '25', article_reference: 'MiFID II Article 25',
    entities: ['knowledge competence', 'investment advice', 'natural persons', 'financial instruments', 'suitability'],
    content: `Member States shall require investment firms to ensure and demonstrate to competent authorities on request that natural persons giving investment advice or information about financial instruments possess the necessary knowledge and competence to fulfil their obligations. Front Office staff providing investment advice must hold documented evidence of regulatory competence and complete role-specific training on applicable MiFID II obligations.` },
];

async function seedFromPdfs(pdfDir: string): Promise<boolean> {
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) return false;

  console.log(`Found ${files.length} PDF(s) in ${pdfDir} — processing with parent-child chunking...`);

  for (const file of files) {
    const regulation = PDF_REGULATION_MAP[file.toLowerCase()];
    if (!regulation) {
      console.log(`  Skipping ${file} — no regulation mapping (add to PDF_REGULATION_MAP)`);
      continue;
    }

    console.log(`  Processing ${file} → ${regulation}`);
    const buf = fs.readFileSync(path.join(pdfDir, file));
    const { parents } = await chunkPdf(buf);
    console.log(`    Extracted ${parents.length} section chunks`);

    // Generate embeddings in batches
    const texts = parents.map(p => p.content);
    const embeddings = await embedTexts(texts);

    let inserted = 0;
    for (let i = 0; i < parents.length; i++) {
      const p = parents[i]!;
      const embedding = embeddings[i];
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

      await db.query(
        `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, entities, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (regulation, article_number) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
        [
          regulation,
          p.sectionNumber ?? `chunk-${i}`,
          p.sectionHeading ?? `${regulation} section ${i}`,
          [],
          p.content,
          embeddingStr,
        ]
      );
      inserted++;
    }
    console.log(`    Inserted/updated ${inserted} chunks with embeddings`);
  }
  return true;
}

async function seedFromHardcoded(): Promise<void> {
  console.log('No PDFs found — seeding from hardcoded chunks with Voyage AI embeddings...');

  const texts = SEED_CHUNKS.map(c => c.content);
  const embeddings = await embedTexts(texts);

  let inserted = 0;
  for (let i = 0; i < SEED_CHUNKS.length; i++) {
    const chunk = SEED_CHUNKS[i]!;
    const embedding = embeddings[i];
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    await db.query(
      `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, entities, content, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (regulation, article_number) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [chunk.regulation, chunk.article_number, chunk.article_reference, chunk.entities, chunk.content, embeddingStr]
    );
    inserted++;
  }
  console.log(`Seeded ${inserted} chunks with embeddings`);
}

async function seed() {
  const pdfDir = path.join(__dirname, 'pdfs');
  const hasPdfDir = fs.existsSync(pdfDir);

  const usedPdfs = hasPdfDir && await seedFromPdfs(pdfDir);
  if (!usedPdfs) await seedFromHardcoded();

  // Verify
  const { rows } = await db.query<{ regulation: string; total: string; embedded: string }>(
    `SELECT regulation, COUNT(*) as total, COUNT(embedding) as embedded FROM regulatory_chunks GROUP BY regulation`
  );
  console.log('\nSeed verification:');
  for (const row of rows) {
    console.log(`  ${row.regulation}: ${row.embedded}/${row.total} with embeddings`);
  }

  await db.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
