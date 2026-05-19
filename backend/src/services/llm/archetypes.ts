import type { TrainingPlan, RiskDimensionScore } from '../../types';

// ===========================================================================
// Archetype Fallback Templates — Deterministic, Pre-Validated Training Plans
//
// These 5 plans represent ~40+ hours of consultant manual work, encoded into
// regulation-validated JSON. They are the "hard to copy" IP of the product.
//
// Usage: When classification confidence >= 85%, merge LLM output with archetype
// to ensure coverage, depth, and audit defensibility even if the LLM fails.
// ===========================================================================

export const ARchetypeRoles = [
  'Customer Advisor',
  'KYC Analyst',
  'TM Analyst',
  'AML DDI Manager',
  'MLRO',
] as const;

export type ArchetypeRole = (typeof ARchetypeRoles)[number];

export interface RoleArchetype {
  role_title: string;
  classified_as: ArchetypeRole;
  line_of_defence: '1LoD' | '2LoD';
  // Ideal risk matrix for this role (used for gap detection)
  risk_matrix: RiskDimensionScore[];
  // Pre-computed training plan
  plan: TrainingPlan;
}

// ── HELPER: standard module factory ──────────────────────────────────────────
function mod(
  name: string,
  hours: number,
  dimension: string,
  article: string,
  why: string,
) {
  return { module_name: name, duration_hours: hours, risk_dimension: dimension, amlr_article: article, why_included: why };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE 1: Customer Advisor (1LoD — Frontline)
// Risk profile: AML: Medium | Sanctions: Low | Fraud: Medium | Doc: Low | Esc: Medium
// Training depth: Foundation — awareness, red flags, escalation procedures
// ═══════════════════════════════════════════════════════════════════════════
export const CUSTOMER_ADVISOR_ARCHETYPE: RoleArchetype = {
  role_title: 'Customer Advisor',
  classified_as: 'Customer Advisor',
  line_of_defence: '1LoD',
  risk_matrix: [
    { dimension: 'AML Risk',         score: 'Medium',  justification: 'First contact point for customers: weak ID verification or missed red flags allow bad actors to enter undetected.' },
    { dimension: 'Sanctions Risk',   score: 'Low',     justification: 'Customer Advisors are not responsible for sanctions screening; this is handled by KYC/Compliance teams.' },
    { dimension: 'Fraud Risk',       score: 'Medium',  justification: 'Advisors may encounter fraud attempts during onboarding or transaction processing if escalation protocols fail.' },
    { dimension: 'Documentation Risk', score: 'Low',   justification: 'Advisors capture basic data but do not create complex risk rationales or audit trails.' },
    { dimension: 'Escalation Risk',  score: 'Medium',  justification: 'Failure to escalate suspicious behaviour or high-risk customers directly enables money laundering.' },
  ],
  plan: {
    role_title: 'Customer Advisor',
    training_philosophy: 'Year 1 builds foundational AML awareness, recognition of red flags, and clear escalation pathways. Years 2–4 refresh through annual updates and scenario-based reinforcement.',
    quarters: [
      {
        quarter: 'Q1', name: 'Foundation', months: 'Months 1–3',
        modules: [
          mod('AML/CTF Fundamentals and the Regulatory Framework', 4, 'AML Risk', 'Article 12',
            'Article 12 requires training appropriate to the role. As the frontline contact with customers, foundational AML literacy is essential for recognising suspicious activity.'),
          mod('Customer Identification and Verification (CDD Basics)', 3, 'AML Risk', 'Article 10',
            'Article 10 mandates customer due diligence measures. Customer Advisors must understand ID verification requirements as they are the first point of contact.'),
          mod('Red Flags and Suspicious Behaviour Recognition', 3, 'AML Risk', 'Article 12',
            'Article 12 requires training that enables employees to identify ML/TF activities. Frontline Advisors are uniquely positioned to spot early warning signs.'),
          mod('Escalation Procedures and Internal Reporting', 2, 'Escalation Risk', 'Article 9',
            'Article 9 requires documented internal controls including escalation. Advisors must know exactly how and when to escalate without hesitation.'),
          mod('Introduction to Sanctions Screening (Awareness Level)', 2, 'Sanctions Risk', 'Article 10',
            'Article 10 includes sanctions verification. While Advisors do not screen directly, they must understand sanctions risk and when to refer to specialists.'),
        ],
      },
      {
        quarter: 'Q2', name: 'Application', months: 'Months 4–6',
        modules: [
          mod('Handling High-Risk Product Sales', 3, 'AML Risk', 'Article 10',
            'Article 10 requires enhanced diligence for high-risk scenarios. Advisors selling higher-risk products must understand-triggering factors and referral pathways.'),
          mod('Fraud Prevention and Social Engineering Defence', 3, 'Fraud Risk', 'Article 9',
            'Article 9 requires controls that mitigate fraud risk. Advisors are frequent targets of social engineering and must be trained to resist manipulation.'),
          mod('Consumer Duty and Customer Vulnerability', 2, 'AML Risk', 'Article 12',
            'Article 12 training must be appropriate to role functions. UK Consumer Duty and EU equivalent obligations require Advisors to identify and protect vulnerable customers.'),
          mod('Case Study: Failed Escalation and Regulatory Consequence', 2, 'Escalation Risk', 'Article 12',
            'Article 12 records must document training. Case-based learning reinforces why escalation failures lead directly to regulatory and criminal exposure.'),
          mod('Peer Review and Shadowing: Senior Advisor Observation', 2, 'AML Risk', 'Article 13',
            'Article 13 requires skills assessment before independent activity. Peer review ensures foundational competency before Advisors handle customers unsupervised.'),
        ],
      },
      {
        quarter: 'Q3', name: 'Deepening', months: 'Months 7–9',
        modules: [
          mod('Typologies Relevant to Retail Banking', 3, 'AML Risk', 'Article 12',
            'Article 12 requires ongoing training updated for new typologies. Advisors must recognise smurfing, romance scams, and mule account indicators.'),
          mod('Cross-Border and Correspondent Banking Awareness', 2, 'AML Risk', 'Article 10',
            'Article 10 covers CDD for complex relationships. Advisors encountering cross-border clients must know when to trigger enhanced due diligence.'),
          mod('Collaborative Workshop: Frontline + Compliance', 2, 'Escalation Risk', 'Article 11',
            'Article 11 requires the compliance function to have sufficient resources. Cross-team workshops build the escalation rapport that makes controls effective.'),
          mod('Digital Onboarding Risks and Remote ID Challenges', 2, 'Fraud Risk', 'Article 10',
            'Article 10 verification requirements extend to digital channels. Advisors handling remote onboarding must understand document fraud and spoofing risks.'),
        ],
      },
      {
        quarter: 'Q4', name: 'Embedding', months: 'Months 10–12',
        modules: [
          mod('Regulatory Update Review: AMLR 2024/1624 Changes', 2, 'AML Risk', 'Article 12',
            'Article 12 mandates regularly updated training. Annual review ensures Advisors are current on regulatory developments affecting frontline operations.'),
          mod('Full Competency Assessment and Certification', 3, 'AML Risk', 'Article 13',
            'Article 13 requires skills and integrity assessments. Year 1 closes with a formal assessment validating that the Advisor can operate independently and compliantly.'),
          mod('Personal Development Plan for Year 2', 2, 'AML Risk', 'Article 12',
            'Article 12 training must be ongoing. The Year 2 plan identifies specialisation pathways (e.g. SME onboarding, wealth management) based on performance and interest.'),
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE 2: KYC Analyst (1LoD — Specialist)
// Risk profile: AML: High | Sanctions: High | Fraud: Medium | Doc: High | Esc: High
// Training depth: Advanced — EDD, beneficial ownership, SoF/SoW, PEP screening
// ═══════════════════════════════════════════════════════════════════════════
export const KYC_ANALYST_ARCHETYPE: RoleArchetype = {
  role_title: 'KYC Analyst',
  classified_as: 'KYC Analyst',
  line_of_defence: '1LoD',
  risk_matrix: [
    { dimension: 'AML Risk',         score: 'High',    justification: 'Handles the highest-risk customers. Flawed EDD analysis allows illegitimate clients to enter the bank undetected.' },
    { dimension: 'Sanctions Risk',   score: 'High',    justification: 'Must screen against global sanctions lists and PEP databases every day; missed matches create direct regulatory exposure.' },
    { dimension: 'Fraud Risk',       score: 'Medium',  justification: 'Involved in identity verification and document assessment; indirect exposure to forged documents and synthetic identity fraud.' },
    { dimension: 'Documentation Risk', score: 'High',  justification: 'Must produce auditable risk rationales for every client file; poor documentation weakens the entire regulatory audit trail.' },
    { dimension: 'Escalation Risk',  score: 'High',    justification: 'Failure to escalate suspicious indicators to the MLRO within regulatory timeframes directly causes a compliance breach.' },
  ],
  plan: {
    role_title: 'KYC Analyst',
    training_philosophy: 'Year 1 builds deep EDD competency, assessed to regulatory standard. Years 2–4 maintain through advanced typologies, jurisdictional updates, and specialist certification.',
    quarters: [
      {
        quarter: 'Q1', name: 'Foundation', months: 'Months 1–3',
        modules: [
          mod('AML/CTF Fundamentals and AMLR 2024/1624 Overview', 4, 'AML Risk', 'Article 12',
            'Article 12 requires training appropriate to the ML/TF risks this role faces. As a KYC Analyst handling high-risk customers, foundational AML literacy is the non-negotiable baseline.'),
          mod('Enhanced Due Diligence (EDD) Standards and Case Handling', 6, 'AML Risk', 'Article 10',
            'Article 10 mandates comprehensive CDD measures. This role\'s primary function is deep EDD; without mastery, the role cannot fulfil its regulatory purpose.'),
          mod('Beneficial Ownership Identification and Verification', 4, 'AML Risk', 'Article 10',
            'Article 10(b) requires beneficial owner identification. KYC Analysts must untangle complex ownership structures up to the ultimate beneficial owner.'),
          mod('Source of Funds (SoF) and Source of Wealth (SoW) Assessment', 4, 'AML Risk', 'Article 10',
            'Article 10 requires understanding the purpose and nature of relationships. SoF/SoW confirmation is mandatory for high-risk customers and a core analytical skill.'),
          mod('PEP, Family Members and Close Associate Screening', 4, 'Sanctions Risk', 'Article 10',
            'Article 10(g) mandates PEP identification. PEPs trigger automatic enhanced scrutiny; failure to detect them is a direct regulatory breach.'),
          mod('Global Sanctions Lists and Real-Time Screening Tools', 3, 'Sanctions Risk', 'Article 10',
            'Article 10(d) requires sanctions verification. KYC Analysts must operate screening tools with zero tolerance for missed matches.'),
        ],
      },
      {
        quarter: 'Q2', name: 'Application', months: 'Months 4–6',
        modules: [
          mod('Independent EDD Caseload: Corporate and Complex Structures', 5, 'AML Risk', 'Article 10',
            'Article 10(g) covers legal entity verification. Independent caseloads test the Analyst\'s ability to assess corporate clients, trusts, and layered ownership.'),
          mod('Document Fraud Detection and Forgery Recognition', 4, 'Fraud Risk', 'Article 13',
            'Article 13 requires skills assessment. Forged utility bills, fake passports, and synthetic IDs are common attack vectors against KYC processes.'),
          mod('Jurisdictional Risk Assessment and High-Risk Countries', 3, 'AML Risk', 'Article 10',
            'Article 10 expectations vary by jurisdiction. Analysts must understand FATF grey-list implications and internal country-risk ratings.'),
          mod('Peer Review: Quality-Checking Analyst Colleague Files', 3, 'Documentation Risk', 'Article 11',
            'Article 11 requires compliance oversight. Peer review builds the quality-mindset and prepares senior Analysts for team-lead roles.'),
          mod('SAR Escalation: Writing Clear, Defensible Reports', 3, 'Escalation Risk', 'Article 12',
            'Article 12 training must instruct employees how to proceed in suspicious cases. SAR writing is a critical escalation skill with legal consequences.'),
        ],
      },
      {
        quarter: 'Q3', name: 'Deepening', months: 'Months 7–9',
        modules: [
          mod('Advanced Money Laundering Typologies: Trade-Based, Real Estate, Virtual Assets', 5, 'AML Risk', 'Article 12',
            'Article 12 requires training updated for new typologies. KYC Analysts defending the front gate must recognise evolving methods before they enter the bank.'),
          mod('Cross-Border Due Diligence and Correspondent Banking', 4, 'AML Risk', 'Article 10',
            'Article 10 applies to all customer relationships. Cross-border and correspondent clients carry amplified jurisdictional and concealment risks.'),
          mod('Workshop: Collaboration with Compliance and Legal', 3, 'Escalation Risk', 'Article 11',
            'Article 11 requires the compliance officer to have sufficient resources. Cross-functional workshops build the trust and protocols needed for effective escalation.'),
          mod('GDPR/AMLR Intersection: Lawful Processing of Sensitive Data', 3, 'Documentation Risk', 'Article 15',
            'Article 15 mandates GDPR compliance. KYC Analysts handle highly sensitive personal data and must understand lawful processing boundaries.'),
          mod('Specialist Certification: CAMS or Internal Equivalent', 3, 'AML Risk', 'Article 13',
            'Article 13 requires ongoing skills assessment. External certification validates competency and signals regulatory commitment.'),
        ],
      },
      {
        quarter: 'Q4', name: 'Embedding', months: 'Months 10–12',
        modules: [
          mod('Regulatory Update Review: AMLA, AMLR Amendments, New Guidance', 3, 'AML Risk', 'Article 12',
            'Article 12 mandates regularly updated programmes. Annual updates cover AMLA guidance, FATF revisions, and national supervisor expectations.'),
          mod('Full Competency Assessment: EDD, Documentation, Escalation', 4, 'AML Risk', 'Article 13',
            'Article 13 requires skills assessment before and during activities. Year 1 closes with comprehensive testing of the core KYC competency triad.'),
          mod('Personal Development Plan: Senior Analyst or AML DDI Pathway', 2, 'AML Risk', 'Article 12',
            'Article 12 training is ongoing. Year 2 planning identifies whether the Analyst progresses to specialist, team-lead, or compliance-track roles.'),
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE 3: Transaction Monitoring (TM) Analyst (1LoD — Investigative)
// Risk profile: AML: High | Sanctions: Medium | Fraud: Medium | Doc: High | Esc: High
// Training depth: Intermediate-Advanced — alerts, SAR writing, typologies, case docs
// ═══════════════════════════════════════════════════════════════════════════
export const TM_ANALYST_ARCHETYPE: RoleArchetype = {
  role_title: 'Transaction Monitoring Analyst',
  classified_as: 'TM Analyst',
  line_of_defence: '1LoD',
  risk_matrix: [
    { dimension: 'AML Risk',           score: 'High',    justification: 'The point where financial crime becomes visible. Missed alerts enable layering and integration of illicit funds.' },
    { dimension: 'Sanctions Risk',     score: 'Medium',  justification: 'Sanctions hits may surface in TM alerts; Analysts must understand when an alert triggers a sanctions escalation, not just an AML one.' },
    { dimension: 'Fraud Risk',         score: 'Medium',  justification: 'Fraud patterns (account takeover, mule activity) often generate TM alerts; Analysts must distinguish fraud typologies from ML.' },
    { dimension: 'Documentation Risk', score: 'High',    justification: 'Investigation notes form the primary evidence for SARs and regulatory inspections; poor documentation invalidates the entire case.' },
    { dimension: 'Escalation Risk',    score: 'High',    justification: 'Regulatory timeframes for SAR filing are strict; delayed escalation breaches those timeframes and exposes the firm to criminal liability.' },
  ],
  plan: {
    role_title: 'Transaction Monitoring Analyst',
    training_philosophy: 'Year 1 builds alert-review competency, SAR-writing precision, and investigatory discipline. Years 2–4 advance through typology mastery and system-led analytics.',
    quarters: [
      {
        quarter: 'Q1', name: 'Foundation', months: 'Months 1–3',
        modules: [
          mod('AML/CTF Fundamentals for Investigative Roles', 4, 'AML Risk', 'Article 12',
            'Article 12 requires role-specific training. TM Analysts need deep understanding of placement, layering, and integration to interpret alerts correctly.'),
          mod('Transaction Monitoring Systems and Alert Mechanics', 4, 'AML Risk', 'Article 9',
            'Article 9 requires internal control procedures. Analysts must understand rule thresholds, scenario logic, and system parameters to triage effectively.'),
          mod('SAR Writing: Structure, Evidence, and Regulatory Standards', 5, 'Escalation Risk', 'Article 12',
            'Article 12 training must instruct how to proceed in suspicious cases. SAR writing is the primary regulatory output of this role; precision is mandatory.'),
          mod('Case Documentation and Investigation Note Standards', 4, 'Documentation Risk', 'Article 14',
            'Article 14 requires record-keeping. Investigation notes must be complete, contemporaneous, and defensible in court and regulatory review.'),
          mod('Escalation Pathways: When to File, When to Monitor, When to Close', 3, 'Escalation Risk', 'Article 9',
            'Article 9 requires documented internal controls. Clear escalation protocols prevent both over-filing and under-filing, each of which carries risk.'),
        ],
      },
      {
        quarter: 'Q2', name: 'Application', months: 'Months 4–6',
        modules: [
          mod('Independent Alert Review: Domestic and Cross-Border Cases', 5, 'AML Risk', 'Article 12',
            'Article 12 training must be ongoing and practical. Independent caseloads test whether the Analyst can apply foundation knowledge without supervision.'),
          mod('Customer Profiling: Expected vs. Actual Activity Analysis', 4, 'AML Risk', 'Article 10',
            'Article 10 requires ongoing monitoring. Analysts must compare flagged transactions against the customer\'s known profile and risk tier.'),
          mod('Typology Recognition: Structuring, Rapid Movement, Cash Intensity', 4, 'AML Risk', 'Article 12',
            'Article 12 requires updated typology training. Structured deposits, rapid succession transfers, and cash-intensive businesses are core TM indicators.'),
          mod('Distinguishing Fraud from Money Laundering in Alerts', 3, 'Fraud Risk', 'Article 12',
            'Article 12 training must cover all relevant risks. Fraud typologies (ATO, mules, APP scams) generate TM alerts and require different escalation paths.'),
          mod('Peer Review and Quality Assurance of Investigation Files', 3, 'Documentation Risk', 'Article 11',
            'Article 11 requires compliance oversight. Peer review builds consistency and trains senior Analysts to quality-check junior work.'),
        ],
      },
      {
        quarter: 'Q3', name: 'Deepening', months: 'Months 7–9',
        modules: [
          mod('Advanced Typologies: Trade-Based ML, Virtual Assets, Real Estate', 4, 'AML Risk', 'Article 12',
            'Article 12 requires training on new developments. Sophisticated typologies often surface only in TM alerts; Analysts must recognise subtle patterns.'),
          mod('Network Analysis: Linking Related Accounts and Parties', 4, 'AML Risk', 'Article 10',
            'Article 10 requires understanding ownership structures. Network analysis connects seemingly unrelated accounts controlled by the same criminal entity.'),
          mod('Sanctions Escalation Within TM Alerts', 3, 'Sanctions Risk', 'Article 10',
            'Article 10(d) requires sanctions screening. TM Analysts must understand when an alert suggests sanctions evasion and escalate immediately to the sanctions team.'),
          mod('Workshop: Collaboration with Law Enforcement and FIU', 3, 'Escalation Risk', 'Article 11',
            'Article 11 requires the compliance function to engage externally. Understanding law enforcement expectations improves SAR quality and follow-up cooperation.'),
        ],
      },
      {
        quarter: 'Q4', name: 'Embedding', months: 'Months 10–12',
        modules: [
          mod('Regulatory Update: New Typologies, System Rules, and Guidance', 3, 'AML Risk', 'Article 12',
            'Article 12 mandates regularly updated training. Annual updates cover system rule changes, new scenario deployments, and supervisor guidance.'),
          mod('Full Competency Assessment: Alert Review, SAR Writing, Documentation', 4, 'AML Risk', 'Article 13',
            'Article 13 requires skills and integrity assessment. Year 1 closes with testing the three core TM competencies: review, write, document.'),
          mod('Career Pathway: Senior Analyst, Quality Assurance, or SAR Specialist', 2, 'AML Risk', 'Article 12',
            'Article 12 training is ongoing. Year 2 planning identifies specialisation: complex caseloads, QA oversight, or SAR-first investigator roles.'),
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE 4: AML DDI Manager (2LoD — Management)
// Risk profile: AML: High | Sanctions: High | Fraud: Low | Doc: High | Esc: Medium
// Training depth: Advanced-Intermediate — third-party risk, GDPR/AMLR, QA, team accountability
// ═══════════════════════════════════════════════════════════════════════════
export const AML_DDI_MANAGER_ARCHETYPE: RoleArchetype = {
  role_title: 'AML DDI Manager',
  classified_as: 'AML DDI Manager',
  line_of_defence: '2LoD',
  risk_matrix: [
    { dimension: 'AML Risk',         score: 'High',    justification: 'Oversees KYC/AML checks on delivery partners and suppliers; oversight failures allow non-compliant partners to remain active.' },
    { dimension: 'Sanctions Risk',   score: 'High',    justification: 'Responsible for ensuring third parties are not sanctioned; missed matches create direct regulatory and reputational exposure.' },
    { dimension: 'Fraud Risk',       score: 'Low',     justification: 'DDI focuses on partner and supplier due diligence, not transaction-level fraud detection; fraud risk is minimal.' },
    { dimension: 'Documentation Risk', score: 'High',  justification: 'Maintains the data asset register (GDPR) and partner risk files; errors propagate across the entire AML team\'s audit trail.' },
    { dimension: 'Escalation Risk',  score: 'Medium',  justification: 'Must escalate partner risk deterioration and compliance breaches to senior management and the MLRO in a timely manner.' },
  ],
  plan: {
    role_title: 'AML DDI Manager',
    training_philosophy: 'Year 1 builds third-party risk management, team accountability, and the intersection of GDPR and AMLR. Years 2–4 deepen through regulatory engagement and advanced oversight.',
    quarters: [
      {
        quarter: 'Q1', name: 'Foundation', months: 'Months 1–3',
        modules: [
          mod('AML/CTF Regulatory Framework for Oversight Roles', 4, 'AML Risk', 'Article 12',
            'Article 12 requires role-specific training. As a 2LoD manager, this role must understand the full regulatory landscape to design and challenge controls.'),
          mod('Third-Party Risk Management and Due Diligence Standards', 5, 'AML Risk', 'Article 10',
            'Article 10 mandates CDD measures for all relationships, including suppliers and delivery partners. DDI Managers must design proportional due diligence frameworks.'),
          mod('GDPR and AMLR Intersection: Data Asset Register Management', 4, 'Documentation Risk', 'Article 15',
            'Article 15 subjects AMLR processing to GDPR. DDI Managers maintain the data asset register and must navigate dual compliance requirements.'),
          mod('Team Management and AML Analyst Coaching Skills', 3, 'AML Risk', 'Article 13',
            'Article 13 requires skills assessments. DDI Managers must coach Analysts, identify competency gaps, and escalate performance issues to HR/Compliance.'),
          mod('Internal Controls and Policy Documentation Standards', 3, 'AML Risk', 'Article 9',
            'Article 9 requires documented policies. DDI Managers contribute to policy design and must ensure procedures are current, accessible, and enforceable.'),
        ],
      },
      {
        quarter: 'Q2', name: 'Application', months: 'Months 4–6',
        modules: [
          mod('Supplier Onboarding and Periodic Review Framework', 4, 'AML Risk', 'Article 10',
            'Article 10 requires ongoing monitoring. DDI Managers must build review cycles, trigger events, and recertification schedules for all third parties.'),
          mod('Quality Assurance: Sampling and File Review Methodology', 4, 'Documentation Risk', 'Article 11',
            'Article 11 requires the compliance function to have sufficient resources. QA sampling is the primary oversight mechanism for validating Analyst work.'),
          mod('Sanctions Screening for Non-Customer Relationships', 3, 'Sanctions Risk', 'Article 10',
            'Article 10 sanctions checks apply to beneficial owners and controllers of suppliers. DDI Managers must ensure screening coverage extends beyond direct customers.'),
          mod('Escalation to MLRO and Senior Management: Protocols and Timing', 3, 'Escalation Risk', 'Article 11',
            'Article 11 requires direct board reporting. DDI Managers must know when and how to escalate partner risk deterioration without delay.'),
          mod('Cross-Functional Workshop: DDI + Procurement + Legal', 2, 'AML Risk', 'Article 11',
            'Article 11 requires compliance engagement across the firm. Workshops build the relationships needed to enforce AML requirements in procurement processes.'),
        ],
      },
      {
        quarter: 'Q3', name: 'Deepening', months: 'Months 7–9',
        modules: [
          mod('Advanced Third-Party Typologies: Shell Companies, Nested Relationships', 4, 'AML Risk', 'Article 12',
            'Article 12 requires updated typology training. Sophisticated supplier structures conceal beneficial ownership; DDI Managers must design detection controls.'),
          mod('Regulatory Inspection Preparation and Response', 3, 'Documentation Risk', 'Article 14',
            'Article 14 requires five-year record retention. Inspection readiness depends on organised, complete, and retrievable partner risk files.'),
          mod('Data Protection Impact Assessments (DPIA) for AML Processes', 3, 'Documentation Risk', 'Article 15',
            'Article 15 mandates GDPR compliance. DDI Managers must understand when a DPIA is required and how to document lawful processing for AML purposes.'),
          mod('Leadership Skills: Managing a Remote or Distributed AML Team', 2, 'AML Risk', 'Article 13',
            'Article 13 requires integrity assessments. DDI Managers are responsible for team culture, ethical standards, and managing conflicts of interest.'),
        ],
      },
      {
        quarter: 'Q4', name: 'Embedding', months: 'Months 10–12',
        modules: [
          mod('Regulatory Update: AMLA, AMLR Amendments, Supervisory Guidance', 2, 'AML Risk', 'Article 12',
            'Article 12 mandates regularly updated training. Annual updates cover AMLA binding guidelines, FATF revisions, and national regulatory expectations.'),
          mod('Full Management Competency Assessment', 3, 'AML Risk', 'Article 13',
            'Article 13 requires ongoing assessment. Year 1 closes with evaluation of technical knowledge, leadership competency, and ethical integrity.'),
          mod('Year 2 Planning: Senior Manager or MLRO Pathway', 2, 'AML Risk', 'Article 12',
            'Article 12 training is ongoing. Year 2 identifies whether the Manager progresses to broader compliance leadership or MLRO accountability.'),
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE 5: MLRO (2LoD — Senior)
// Risk profile: AML: Critical | Sanctions: Critical | Fraud: High | Doc: High | Esc: Critical
// Training depth: Advanced/Strategic — SAR accountability, regulatory reporting, Board communication, policy design, enforcement engagement
// ═══════════════════════════════════════════════════════════════════════════
export const MLRO_ARCHETYPE: RoleArchetype = {
  role_title: 'MLRO',
  classified_as: 'MLRO',
  line_of_defence: '2LoD',
  risk_matrix: [
    { dimension: 'AML Risk',         score: 'Critical', justification: 'Personal criminal liability for wrong SAR decisions. Blind spots at this level cascade across all defences. Highest regulatory and reputational exposure.' },
    { dimension: 'Sanctions Risk',   score: 'Critical', justification: 'Ultimate accountability for sanctions compliance failures. Regulatory enforcement actions against the MLRO personally are increasingly common.' },
    { dimension: 'Fraud Risk',       score: 'High',    justification: 'Fraud often intersects with ML; MLRO must understand fraud typologies to design controls that address both threats simultaneously.' },
    { dimension: 'Documentation Risk', score: 'High',  justification: 'Board reports, SAR registers, and regulatory correspondence form the historical record of AML governance; errors undermine the entire programme.' },
    { dimension: 'Escalation Risk',  score: 'Critical', justification: 'The MLRO is the escalation terminus. Every suspicious activity in the firm must reach the MLRO, and every SAR decision is personally accountable.' },
  ],
  plan: {
    role_title: 'MLRO',
    training_philosophy: 'Year 1 builds strategic AML governance, SAR accountability, and board communication capability. Years 2–4 deepen through enforcement engagement, policy design leadership, and crisis management.',
    quarters: [
      {
        quarter: 'Q1', name: 'Foundation', months: 'Months 1–3',
        modules: [
          mod('AMLR 2024/1624: Strategic Overview for Senior Leadership', 4, 'AML Risk', 'Article 12',
            'Article 12 requires senior leaders to be trained commensurate with their accountability. The MLRO must master every article, not just the headline obligations.'),
          mod('SAR Decision-Making: Criteria, Evidence, and Criminal Liability', 5, 'Escalation Risk', 'Article 12',
            'Article 12 requires training on how to proceed in suspicious cases. For the MLRO, this is the core accountability: every SAR decision carries personal criminal liability.'),
          mod('Sanctions Compliance: Global Regimes, Enforcement Trends, Personal Liability', 4, 'Sanctions Risk', 'Article 10',
            'Article 10 sanctions verification is foundational. The MLRO must understand OFAC, EU, and UK sanctions regimes and the trajectory of personal enforcement actions.'),
          mod('Internal Controls and Policy Design for the Entire Firm', 4, 'AML Risk', 'Article 9',
            'Article 9 mandates documented, proportionate internal policies. The MLRO designs the control architecture that every other role operates within.'),
          mod('Governance Structures: 1LoD, 2LoD, 3LoD and the MLRO\'s Role', 3, 'AML Risk', 'Article 11',
            'Article 11 requires the compliance function to have board access. The MLRO must understand how the three lines interact and where accountability sits.'),
          mod('Board Reporting: Metrics, MI, and Regulatory Communication', 3, 'Documentation Risk', 'Article 11',
            'Article 11 requires direct board reporting. Board-ready MI must be accurate, timely, and actionable — poor reporting creates blind spots at the highest level.'),
        ],
      },
      {
        quarter: 'Q2', name: 'Application', months: 'Months 4–6',
        modules: [
          mod('Live SAR Decision Review: Complex Cases and Legal Nuance', 5, 'Escalation Risk', 'Article 12',
            'Article 12 training must be practical. The MLRO reviews real (anonymised) SAR cases to sharpen judgment on the borderline between filing and not filing.'),
          mod('Regulatory Engagement: FIU, Supervisor, and Law Enforcement Interaction', 4, 'AML Risk', 'Article 11',
            'Article 11 requires external-facing compliance. The MLRO must understand how to respond to regulatory requests, thematic reviews, and enforcement investigations.'),
          mod('Risk Appetite and Threshold Calibration Across the Firm', 4, 'AML Risk', 'Article 9',
            'Article 9 requires proportionate controls. The MLRO defines the firm\'s AML risk appetite and calibrates system thresholds, alert volumes, and resource allocation.'),
          mod('Crisis Management: Data Breach, System Failure, or Regulatory Action', 3, 'AML Risk', 'Article 11',
            'Article 11 requires adequate resources. Crisis playbooks ensure the MLRO can respond to AML-related incidents without paralysis or regulatory escalation.'),
          mod('Policy Review: Updating the Firm\'s AML Framework', 3, 'AML Risk', 'Article 9',
            'Article 9 policies must be kept current. The MLRO leads annual policy reviews to reflect regulatory changes, typology evolution, and control weaknesses.'),
        ],
      },
      {
        quarter: 'Q3', name: 'Deepening', months: 'Months 7–9',
        modules: [
          mod('Advanced Typologies: Sophisticated Layering, Integration, and Emerging Threats', 4, 'AML Risk', 'Article 12',
            'Article 12 requires updated typology training. The MLRO must anticipate threats before they materialise in the firm\'s risk profile and control gaps.'),
          mod('International Standards: FATF Recommendations, Wolfsberg Group, Egmont', 3, 'AML Risk', 'Article 12',
            'Article 12 training should include international context. FATF mutual evaluations and Wolfsberg guidance inform national regulatory expectations.'),
          mod('Technology and AI in AML: Opportunities and Oversight Obligations', 3, 'AML Risk', 'Article 9',
            'Article 9 controls may leverage technology. The MLRO must understand AI-driven transaction monitoring, its limitations, and the governance required to deploy it safely.'),
          mod('Workshop: Simulated Regulatory Inspection and Enforcement Interview', 3, 'AML Risk', 'Article 11',
            'Article 11 requires the compliance function to be inspection-ready. Simulated interviews prepare the MLRO for the pressure and precision of real regulatory scrutiny.'),
          mod('Ethics, Conflicts of Interest, and Personal Accountability', 2, 'AML Risk', 'Article 13',
            'Article 13 requires integrity assessments. The MLRO must model ethical behaviour, manage personal conflicts, and enforce standards across the compliance function.'),
        ],
      },
      {
        quarter: 'Q4', name: 'Embedding', months: 'Months 10–12',
        modules: [
          mod('Regulatory Horizon Scanning: AMLA, Future Directives, Global Trends', 3, 'AML Risk', 'Article 12',
            'Article 12 mandates updated training. Horizon scanning ensures the MLRO anticipates regulatory change rather than reacting to it.'),
          mod('Full Strategic Competency Assessment: Governance, Decision-Making, Communication', 4, 'AML Risk', 'Article 13',
            'Article 13 requires regular skills and integrity assessment. Year 1 closes with comprehensive evaluation of the MLRO\'s three strategic competencies: govern, decide, communicate.'),
          mod('Year 2 Planning: Board Effectiveness, External Directorship, or Regulatory Role', 2, 'AML Risk', 'Article 12',
            'Article 12 training is ongoing. Year 2 planning identifies whether the MLRO progresses to broader executive accountability, external board roles, or regulatory advisory positions.'),
        ],
      },
    ],
  },
};

// ── LOOKUP MAP ─────────────────────────────────────────────────────────────
export const ARCHETYPE_MAP: Record<string, RoleArchetype> = {
  'Customer Advisor':   CUSTOMER_ADVISOR_ARCHETYPE,
  'KYC Analyst':        KYC_ANALYST_ARCHETYPE,
  'TM Analyst':         TM_ANALYST_ARCHETYPE,
  'AML DDI Manager':    AML_DDI_MANAGER_ARCHETYPE,
  'MLRO':               MLRO_ARCHETYPE,
};

export function getArchetype(classifiedAs: string): RoleArchetype | null {
  return ARCHETYPE_MAP[classifiedAs] ?? null;
}

export function getKnownArchetypes(): string[] {
  return Object.keys(ARCHETYPE_MAP);
}

// ── MERGE LOGIC ────────────────────────────────────────────────────────────
// When the LLM generates a plan, merge it with the archetype to ensure:
// 1. No High/Critical risk dimension is under-served
// 2. Expected core modules are present
// 3. Every module has a why_included (fallback to archetype if LLM omits)

export interface MergeOptions {
  // If true, inject archetype modules for missing High/Critical dimensions
  ensureCoverage: boolean;
  // If true, fallback to archetype why_included when LLM module lacks one
  fallbackJustification: boolean;
}

export function mergePlanWithArchetype(
  llmPlan: TrainingPlan,
  archetype: RoleArchetype,
  options: MergeOptions = { ensureCoverage: true, fallbackJustification: true },
): TrainingPlan {
  const merged: TrainingPlan = JSON.parse(JSON.stringify(llmPlan));
  const archetypePlan = archetype.plan;

  // Enforce 4 quarters
  while (merged.quarters.length < 4) {
    const qNames = ['Foundation', 'Application', 'Deepening', 'Embedding'];
    const idx = merged.quarters.length;
    merged.quarters.push({
      quarter: `Q${idx + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4',
      name: qNames[idx]!,
      months: `Months ${idx * 3 + 1}–${idx * 3 + 3}`,
      modules: [],
    });
  }

  if (options.ensureCoverage) {
    // Count how many modules address each risk dimension in the LLM plan
    const dimensionCounts: Record<string, number> = {};
    for (const q of merged.quarters) {
      for (const m of q.modules) {
        dimensionCounts[m.risk_dimension] = (dimensionCounts[m.risk_dimension] || 0) + 1;
      }
    }

    // For each High/Critical dimension, ensure at least 2 modules
    for (const riskDim of archetype.risk_matrix) {
      if (riskDim.score === 'High' || riskDim.score === 'Critical') {
        const count = dimensionCounts[riskDim.dimension] || 0;
        if (count < 2) {
          // Find archetype modules for this dimension
          const needed = 2 - count;
          let injected = 0;
          for (const aq of archetypePlan.quarters) {
            for (const am of aq.modules) {
              if (am.risk_dimension === riskDim.dimension && injected < needed) {
                // Inject into the same quarter as archetype, or Q1 if not found
                const targetQ = merged.quarters.find(q => q.quarter === aq.quarter) || merged.quarters[0]!;
                targetQ.modules.push({ ...am, module_name: `${am.module_name} (Archetype)` });
                injected++;
              }
            }
          }
        }
      }
    }
  }

  if (options.fallbackJustification) {
    // Ensure every module has why_included
    for (const q of merged.quarters) {
      for (const m of q.modules) {
        if (!m.why_included || m.why_included.trim().length < 20) {
          // Find matching archetype module by name similarity or dimension
          const fallback = findArchetypeModule(archetypePlan, m.module_name, m.risk_dimension);
          if (fallback) {
            m.why_included = fallback.why_included;
          }
        }
      }
    }
  }

  return merged;
}

function findArchetypeModule(
  plan: TrainingPlan,
  moduleName: string,
  dimension: string,
) {
  // Exact name match first
  for (const q of plan.quarters) {
    for (const m of q.modules) {
      if (m.module_name.toLowerCase() === moduleName.toLowerCase()) return m;
    }
  }
  // Dimension match second
  for (const q of plan.quarters) {
    for (const m of q.modules) {
      if (m.risk_dimension === dimension) return m;
    }
  }
  return null;
}
