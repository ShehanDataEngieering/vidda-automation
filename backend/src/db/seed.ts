import { db } from './client';

const chunks = [
  {
    regulation_name: 'GDPR',
    article_reference: 'Article 5',
    content:
      'Personal data shall be processed lawfully, fairly and in a transparent manner in relation to the data subject (lawfulness, fairness and transparency). Personal data shall be collected for specified, explicit and legitimate purposes and not further processed in a manner that is incompatible with those purposes. Data must be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed (data minimisation).',
  },
  {
    regulation_name: 'GDPR',
    article_reference: 'Article 17',
    content:
      'The data subject shall have the right to obtain from the controller the erasure of personal data concerning him or her without undue delay and the controller shall have the obligation to erase personal data without undue delay where one of the following grounds applies: the personal data are no longer necessary in relation to the purposes for which they were collected; the data subject withdraws consent; the data subject objects to the processing; the personal data have been unlawfully processed.',
  },
  {
    regulation_name: 'GDPR',
    article_reference: 'Article 25',
    content:
      'Taking into account the state of the art, the cost of implementation and the nature, scope, context and purposes of processing as well as the risks of varying likelihood and severity for rights and freedoms of natural persons posed by the processing, the controller shall, both at the time of the determination of the means for processing and at the time of the processing itself, implement appropriate technical and organisational measures designed to implement data-protection principles in an effective manner (data protection by design and by default).',
  },
  {
    regulation_name: 'GDPR',
    article_reference: 'Article 32',
    content:
      'Taking into account the state of the art, the costs of implementation and the nature, scope, context and purposes of processing as well as the risk of varying likelihood and severity for the rights and freedoms of natural persons, the controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including pseudonymisation and encryption of personal data; ongoing confidentiality, integrity, availability and resilience of processing systems.',
  },
  {
    regulation_name: 'GDPR',
    article_reference: 'Article 83',
    content:
      'Infringements of the following provisions shall be subject to administrative fines up to 20 000 000 EUR, or in the case of an undertaking, up to 4% of the total worldwide annual turnover of the preceding financial year, whichever is higher. The supervisory authority shall ensure that the imposition of administrative fines shall in each individual case be effective, proportionate and dissuasive.',
  },
  {
    regulation_name: 'AML',
    article_reference: 'Article 3',
    content:
      'Customer due diligence measures shall be applied by obliged entities in the following circumstances: when establishing a business relationship; when carrying out an occasional transaction that amounts to EUR 15 000 or more; when there is a suspicion of money laundering or terrorist financing, regardless of any derogation, exemption or threshold; when there are doubts about the veracity or adequacy of previously obtained customer identification data.',
  },
  {
    regulation_name: 'AML',
    article_reference: 'Article 13',
    content:
      'In the cases referred to in Article 18 and in other cases of higher risk as determined by Member States or obliged entities, Member States shall require obliged entities to apply enhanced due diligence measures to manage and mitigate those risks appropriately. Enhanced due diligence measures shall include obtaining additional information on the customer and on the beneficial owner, obtaining additional information on the intended nature of the business relationship, obtaining information on the source of funds and source of wealth.',
  },
  {
    regulation_name: 'AML',
    article_reference: 'Article 18',
    content:
      'Member States shall require obliged entities to examine, as far as reasonably possible, the background and purpose of all complex and unusually large transactions and all unusual patterns of transactions which have no apparent economic or lawful purpose. Obliged entities shall increase the degree and nature of monitoring of the business relationship to determine whether those transactions or activities appear suspicious.',
  },
  {
    regulation_name: 'AML',
    article_reference: 'Article 20',
    content:
      'Obliged entities shall apply customer due diligence measures not only to all new customers but also at appropriate times to existing customers on a risk-sensitive basis, including at times when the relevant circumstances of a customer change. The timing of such measures shall be based on an ongoing risk assessment that takes account of the nature of transactions, the business relationship, the customer profile and country or geographic area risk.',
  },
  {
    regulation_name: 'AML',
    article_reference: 'Article 33',
    content:
      'Member States shall require obliged entities, and where applicable their directors and employees, to cooperate fully with the FIU by promptly reporting to the FIU on their own initiative where the obliged entity knows, suspects or has reasonable grounds to suspect that funds are the proceeds of criminal activity or are related to terrorist financing and by promptly providing the FIU, at its request, with all necessary information. Suspicious transaction reports shall be transmitted to the FIU of the Member State in whose territory the obliged entity reporting is established.',
  },
];

async function seed() {
  console.log('Seeding regulatory chunks...');
  for (const chunk of chunks) {
    await db.query(
      `INSERT INTO regulatory_chunks (regulation_name, article_reference, content)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [chunk.regulation_name, chunk.article_reference, chunk.content]
    );
  }
  console.log(`Seeded ${chunks.length} regulatory chunks`);
  await db.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
