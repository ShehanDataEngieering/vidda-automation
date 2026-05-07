import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fetchAllRegulations } from '../services/rag/htmlChunker';
import { embedTexts } from '../services/rag/embeddings';

dotenv.config();

const db = new Pool({ connectionString: process.env['DATABASE_URL'] });

// Fallback hardcoded chunks used only when EUR-Lex fetch fails
const FALLBACK_CHUNKS: Array<{
  regulation: string; article_number: string; article_reference: string;
  entities: string[]; content: string;
}> = [
  { regulation: 'AML', article_number: 'FATF-10', article_reference: 'FATF Recommendation 10',
    entities: ['customer due diligence', 'CDD', 'anonymous accounts', 'beneficial owner'],
    content: `Financial institutions should be prohibited from keeping anonymous accounts or accounts in obviously fictitious names. Financial institutions should be required to undertake customer due diligence (CDD) measures when: establishing business relations; carrying out occasional transactions above EUR 15,000; there is a suspicion of money laundering or terrorist financing regardless of threshold. CDD measures include: identifying the customer and verifying their identity using reliable, independent source documents; identifying the beneficial owner and verifying their identity; understanding the purpose and intended nature of the business relationship.` },
  { regulation: 'AML', article_number: '7', article_reference: 'AMLD6 Article 7',
    entities: ['obliged entities', 'customer due diligence', 'EUR 10000', 'money laundering'],
    content: `Member States shall require obliged entities to apply customer due diligence measures in the following circumstances: when establishing a business relationship; when carrying out an occasional transaction that amounts to EUR 10,000 or more; when there is a suspicion of money laundering or terrorist financing, regardless of any derogation, exemption or threshold.` },
  { regulation: 'AML', article_number: '13', article_reference: 'AMLD6 Article 13',
    entities: ['enhanced due diligence', 'PEP', 'politically exposed person'],
    content: `Member States shall require obliged entities to apply enhanced customer due diligence measures in situations which by their nature can present a higher risk of money laundering or terrorist financing. Politically exposed persons (PEPs) shall always be subject to enhanced due diligence measures including senior management approval for establishing business relationships.` },
  { regulation: 'KYC', article_number: '13', article_reference: 'AMLD5 Article 13',
    entities: ['customer due diligence', 'identity verification', 'beneficial owner'],
    content: `Customer due diligence measures shall comprise: identifying the customer and verifying the customer's identity on the basis of documents, data or information obtained from a reliable and independent source; identifying the beneficial owner and taking reasonable measures to verify that person's identity; conducting ongoing monitoring of the business relationship.` },
  { regulation: 'GDPR', article_number: '5', article_reference: 'GDPR Article 5',
    entities: ['personal data', 'lawful processing', 'data minimisation', 'transparency'],
    content: `Personal data shall be: processed lawfully, fairly and in a transparent manner; collected for specified, explicit and legitimate purposes; adequate, relevant and limited to what is necessary (data minimisation); accurate and kept up to date; kept in a form which permits identification of data subjects for no longer than necessary; processed in a manner that ensures appropriate security.` },
  { regulation: 'GDPR', article_number: '83', article_reference: 'GDPR Article 83',
    entities: ['administrative fines', 'EUR 20 million', '4% global turnover', 'penalties'],
    content: `Infringements shall be subject to administrative fines up to EUR 20,000,000, or in the case of an undertaking, up to 4% of the total worldwide annual turnover of the preceding financial year, whichever is higher.` },
  // DORA — not on legislation.gov.uk (post-Brexit regulation)
  { regulation: 'DORA', article_number: '5', article_reference: 'DORA Article 5 — ICT risk management framework',
    entities: ['ICT risk management', 'digital operational resilience', 'ICT assets', 'strategies policies'],
    content: `Financial entities shall have in place a comprehensive ICT risk management framework as part of their overall risk management system, which shall enable them to address ICT risk quickly, efficiently and comprehensively and to ensure a high level of digital operational resilience. The ICT risk management framework shall include strategies, policies, procedures, ICT protocols and tools that are necessary to duly protect all information assets and ICT assets, including computer software, hardware, servers, as well as to protect all relevant physical components and infrastructures.` },
  { regulation: 'DORA', article_number: '6', article_reference: 'DORA Article 6 — ICT risk management systems and tools',
    entities: ['ICT systems', 'tools', 'ICT risk', 'continuous monitoring', 'resilience'],
    content: `Financial entities shall use and maintain updated ICT systems, protocols and tools that are appropriate to the magnitude of operations supporting the conduct of their activities, in accordance with applicable legislation. Financial entities shall minimise the impact of ICT risk by deploying appropriate tools, policies and procedures. They shall have in place mechanisms to promptly detect anomalous activities, identify performance issues of ICT networks and ICT-related incidents.` },
  { regulation: 'DORA', article_number: '11', article_reference: 'DORA Article 11 — Business continuity',
    entities: ['business continuity', 'disaster recovery', 'ICT incidents', 'recovery time', 'backup'],
    content: `Financial entities shall put in place a comprehensive ICT business continuity policy as an integral part of the operational business continuity policy of the financial entity. Financial entities shall implement ICT business continuity plans including response and recovery measures. As part of their ICT risk management framework, financial entities shall establish recovery time objectives and recovery point objectives for all their ICT assets.` },
  { regulation: 'DORA', article_number: '13', article_reference: 'DORA Article 13 — ICT security policies',
    entities: ['ICT security', 'availability', 'authenticity', 'integrity', 'confidentiality', 'resilience', 'training'],
    content: `Financial entities shall develop, document and implement an ICT security policy defining rules to protect the confidentiality, integrity and availability of data, including personal data, and of information assets and ICT assets, against damage and unauthorised access or usage. Financial entities shall implement technical and procedural measures to protect their network and infrastructure. IT Teams and Risk Officers shall receive specific and regular training on ICT risk management obligations and security awareness.` },
  { regulation: 'DORA', article_number: '17', article_reference: 'DORA Article 17 — ICT-related incident classification',
    entities: ['ICT-related incident', 'major incident', 'classification', 'reporting', 'notification'],
    content: `Financial entities shall classify ICT-related incidents and determine their impact based on criteria such as number of clients or counterparts affected, duration of incident, geographic spread, data losses, criticality of services affected, and economic impact. Financial entities shall report major ICT-related incidents to the relevant competent authority within the timeframes set out in this Regulation.` },
  { regulation: 'DORA', article_number: '24', article_reference: 'DORA Article 24 — Digital operational resilience testing',
    entities: ['penetration testing', 'vulnerability assessment', 'resilience testing', 'TLPT', 'threat-led'],
    content: `Financial entities shall establish, maintain and review, at least yearly, a sound and comprehensive digital operational resilience testing programme as an integral part of the ICT risk management framework. The digital operational resilience testing programme shall include a range of assessments, tests, methodologies, practices and tools. Advanced financial entities shall perform threat-led penetration testing (TLPT) at least every three years.` },
  { regulation: 'DORA', article_number: '28', article_reference: 'DORA Article 28 — ICT third-party risk management',
    entities: ['ICT third-party', 'outsourcing', 'concentration risk', 'contractual arrangements', 'exit strategy'],
    content: `Financial entities shall manage ICT third-party risk as an integral component of ICT risk within their ICT risk management framework. Financial entities shall adopt and regularly review a strategy on ICT third-party risk. Prior to entering into any contractual arrangement on the use of ICT services, financial entities shall identify and assess all relevant risks including concentration risk. Financial entities shall maintain comprehensive registers of all contractual arrangements with ICT third-party service providers.` },
  { regulation: 'MIFID2', article_number: '25', article_reference: 'MiFID II Article 25 — Knowledge and competence',
    entities: ['knowledge competence', 'investment advice', 'financial instruments', 'suitability'],
    content: `Member States shall require investment firms to ensure and demonstrate to competent authorities on request that natural persons giving investment advice or information about financial instruments possess the necessary knowledge and competence to fulfil their obligations. Front Office staff providing investment advice must hold documented evidence of regulatory competence and complete role-specific training on applicable MiFID II obligations.` },
];

const REGULATION_NAMES = ['GDPR', 'AML', 'DORA', 'MIFID2'];

async function seedFromHtml(): Promise<Set<string>> {
  console.log('Fetching regulation text from legislation.gov.uk XML API...');
  const regulationMap = await fetchAllRegulations();
  const seededRegulations = new Set<string>();

  for (const [regulation, chunks] of regulationMap) {
    if (chunks.length === 0) {
      console.log(`  ${regulation}: fetch returned 0 chunks — will use fallback`);
      continue;
    }

    console.log(`  ${regulation}: ${chunks.length} article chunks fetched — embedding...`);
    const texts = chunks.map(c => {
      // Prepend metadata to embedding text for better retrieval
      const meta = `[${regulation} Article ${c.sectionNumber}${c.sectionHeading ? ': ' + c.sectionHeading : ''}]`;
      return `${meta}\n${c.content}`;
    });

    const embeddings = await embedTexts(texts);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i];
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
      const articleRef = `${regulation} Article ${chunk.sectionNumber}${chunk.sectionHeading ? ': ' + chunk.sectionHeading : ''}`;

      await db.query(
        `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, entities, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (regulation, article_number) DO UPDATE
           SET content = EXCLUDED.content,
               article_reference = EXCLUDED.article_reference,
               embedding = EXCLUDED.embedding`,
        [regulation, chunk.sectionNumber, articleRef, [], chunk.content, embeddingStr],
      );
      inserted++;
    }
    console.log(`  ${regulation}: inserted/updated ${inserted} chunks`);
    seededRegulations.add(regulation);
  }

  return seededRegulations;
}

async function seedFallback(regulations: string[]): Promise<void> {
  if (regulations.length === 0) return;
  console.log(`\nSeeding fallback hardcoded chunks for: ${regulations.join(', ')}`);

  const relevant = FALLBACK_CHUNKS.filter(c => regulations.includes(c.regulation));
  const texts = relevant.map(c => c.content);
  const embeddings = await embedTexts(texts);

  let inserted = 0;
  for (let i = 0; i < relevant.length; i++) {
    const chunk = relevant[i]!;
    const embedding = embeddings[i];
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    await db.query(
      `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, entities, content, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (regulation, article_number) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [chunk.regulation, chunk.article_number, chunk.article_reference, chunk.entities, chunk.content, embeddingStr],
    );
    inserted++;
  }
  console.log(`Fallback: seeded ${inserted} chunks`);
}

async function seed() {
  // Primary: fetch from EUR-Lex HTML
  let seeded: Set<string>;
  try {
    seeded = await seedFromHtml();
  } catch (err) {
    console.error('EUR-Lex fetch error, falling back entirely to hardcoded chunks:', err);
    seeded = new Set();
  }

  // Fallback for any regulation that failed to fetch
  const missing = REGULATION_NAMES.filter(r => !seeded.has(r));
  await seedFallback(missing);

  // Also seed KYC fallback (not in EUR-Lex list)
  const { rows: kycRows } = await db.query(
    `SELECT COUNT(*) as n FROM regulatory_chunks WHERE regulation = 'KYC'`
  );
  if (parseInt((kycRows[0] as { n: string }).n) === 0) {
    const kycChunks = FALLBACK_CHUNKS.filter(c => c.regulation === 'KYC');
    const texts = kycChunks.map(c => c.content);
    const embeddings = await embedTexts(texts);
    for (let i = 0; i < kycChunks.length; i++) {
      const chunk = kycChunks[i]!;
      const embedding = embeddings[i];
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
      await db.query(
        `INSERT INTO regulatory_chunks (regulation, article_number, article_reference, entities, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (regulation, article_number) DO NOTHING`,
        [chunk.regulation, chunk.article_number, chunk.article_reference, chunk.entities, chunk.content, embeddingStr],
      );
    }
    console.log(`KYC: seeded ${kycChunks.length} fallback chunks`);
  }

  // Verify
  const { rows } = await db.query<{ regulation: string; total: string; embedded: string }>(
    `SELECT regulation, COUNT(*) as total, COUNT(embedding) as embedded FROM regulatory_chunks GROUP BY regulation ORDER BY regulation`
  );
  console.log('\nSeed verification:');
  for (const row of rows) {
    const pct = Math.round((parseInt(row.embedded) / parseInt(row.total)) * 100);
    console.log(`  ${row.regulation}: ${row.embedded}/${row.total} chunks with embeddings (${pct}%)`);
  }

  await db.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
