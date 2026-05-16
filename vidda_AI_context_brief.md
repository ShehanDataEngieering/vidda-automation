# CONTEXT BRIEF — Vidda Solutions: Compliance Training Generator
> Paste this entire document at the start of any AI conversation.
> The AI will then have everything it needs to help you build, debug, design, or extend this product.

---

## 1. WHAT THIS PRODUCT IS

### One-sentence summary
An AI-powered system that reads a job role description, understands the AML risk that person carries, maps it to EU regulation (AMLR 2024/1624), and automatically generates a structured quarterly compliance training plan — with a human reviewer approving before anything is assigned.

### The problem it solves
Financial institutions today give the same generic AML training to everyone: a frontline Customer Advisor gets the same content as a Money Laundering Reporting Officer. This violates EU Regulation 2024/1624 (AMLR) Article 12, which legally requires training to be **"appropriate to their functions or activities"**. This product fixes that by making training role-specific, risk-driven, and audit-ready.

### Who uses it
A **Compliance Manager** or **Chief Compliance Officer (CCO)** at a regulated financial institution. They import a job role, review the AI's output, approve the training plan, and assign it to staff.

### What the product is NOT
- Not a course creation tool (it plans training, it does not write the training content itself)
- Not a generic LMS (it plugs into an existing LMS at the final step)
- Not a legal advice tool (it maps regulation to roles, but a human compliance officer approves)

---

## 2. DOMAIN LANGUAGE — USE THESE TERMS EXACTLY

When generating code, UI text, prompts, or outputs, always use these terms. They are the language of the compliance world and the jury will evaluate whether you use them correctly.

| Term | Full name | What it means |
|------|-----------|---------------|
| **AMLR** | Anti-Money Laundering Regulation | EU Regulation 2024/1624. The legal framework all training must comply with. Deadline: 2027. |
| **AML** | Anti-Money Laundering | Preventing criminals from disguising illegal money as legitimate income. |
| **KYC** | Know Your Customer | Verifying who a customer is and assessing their risk before and during a relationship. |
| **CDD** | Customer Due Diligence | Standard identity and risk checks applied to all customers. Required by AMLR Chapter III. |
| **EDD** | Enhanced Due Diligence | Deeper checks for high-risk customers — confirms Source of Funds (SoF) and Source of Wealth (SoW). |
| **PEP** | Politically Exposed Person | Someone in a prominent public role. Higher ML risk. Always triggers EDD. |
| **SAR** | Suspicious Activity Report | Mandatory report to the national Financial Intelligence Unit (FIU) when suspicious activity is detected. Failing to file is a criminal offence. |
| **MLRO** | Money Laundering Reporting Officer | The person in a firm with personal accountability for deciding whether to submit a SAR externally. |
| **1LoD** | First Line of Defence | Operational staff: Customer Advisors, KYC Analysts, TM Analysts. They face risk directly. |
| **2LoD** | Second Line of Defence | Oversight layer: Compliance, MLRO, AML DDI Manager. They design policy and challenge the first line. |
| **TM** | Transaction Monitoring | Automated system flagging unusual transaction patterns. TM Analysts review these alerts. |
| **SoF** | Source of Funds | Where does the money in this specific transaction come from? |
| **SoW** | Source of Wealth | How did this person accumulate their total wealth? |
| **CTF** | Counter-Terrorist Financing | Always paired with AML. Same legal framework, different typologies. |
| **Typology** | Money Laundering Typology | A known pattern used to launder money (e.g. smurfing, layering, trade-based ML). Training must cover typologies relevant to each role. |
| **Risk Appetite** | — | The level of AML risk a firm is willing to accept. Training depth maps to this. |
| **Inherent Risk Exposure** | — | The risk a role carries by nature of its function, before any controls. This drives training depth. |
| **LMS** | Learning Management System | Platform where training is assigned, tracked, and marked complete. Our product outputs to this. |
| **AMLA** | Anti-Money Laundering Authority | New EU regulatory body issuing binding guidelines under AMLR from 2026 onwards. |
| **GDPR** | General Data Protection Regulation | EU data law. Relevant because KYC/AML collects sensitive personal data. |
| **DDI** | Due Diligence and Investigations | Team performing KYC/AML checks on delivery partners and suppliers. |

### Risk dimensions (score every role across all five)
| Dimension | What it measures |
|-----------|-----------------|
| **AML Risk** | Risk of the role facilitating money laundering |
| **Sanctions Risk** | Risk of transacting with sanctioned parties |
| **Fraud Risk** | Risk of enabling or missing fraud |
| **Documentation Risk** | Risk of poor record-keeping weakening the audit trail |
| **Escalation Risk** | Risk of suspicious activity not being escalated in time |

**Score scale:** `Low` / `Medium` / `High` / `Critical`

### Training structure vocabulary
| Quarter | Name | What it means |
|---------|------|---------------|
| Q1 | Foundation | Core AML knowledge, regulatory framework, role-specific awareness, shadowing |
| Q2 | Application | Practical application, independent caseload, peer review |
| Q3 | Deepening | Advanced typologies, specialist workshops, cross-team collaboration |
| Q4 | Embedding | Regulatory updates, full competency assessment, personal development plan for year 2 |

---

## 3. THE FIVE ROLES — KNOW THESE INSIDE OUT

The system supports these five roles. Each has a different risk profile that drives training depth.

### Role 1: Customer Advisor (1LoD — frontline)
- **What they do:** Handle customer enquiries, onboard new customers, verify ID documents, recognise and escalate suspicious behaviour.
- **Inherent AML risk:** First contact point — weak ID verification lets bad actors in undetected. High volume means subtle red flags are missed. Relies on escalation protocols working.
- **Risk profile:** AML: Medium | Sanctions: Low | Fraud: Medium | Documentation: Low | Escalation: Medium
- **Training depth:** Foundation. AML awareness, red flags, KYC onboarding process, escalation procedures, Consumer Duty.

### Role 2: KYC Analyst (1LoD — specialist)
- **What they do:** Conduct Enhanced Due Diligence on high-risk customers. Validate ownership structures, assess Source of Funds and Source of Wealth, perform periodic reviews, escalate suspicious indicators.
- **Inherent AML risk:** Handles the bank's highest-risk customers. Relies on professional judgement, not checklists. Weak analysis lets illegitimate customers through undetected. Failure to escalate directly causes a regulatory breach.
- **Risk profile:** AML: High | Sanctions: High | Fraud: Medium | Documentation: High | Escalation: High
- **Training depth:** Advanced. EDD, beneficial ownership, SoF/SoW assessment, PEP identification, jurisdictional risk.

### Role 3: Transaction Monitoring (TM) Analyst (1LoD — investigative)
- **What they do:** Review automated TM alerts daily. Investigate flagged transactions against customer profiles. Decide to discard, monitor, or escalate as a SAR. Document investigation notes.
- **Inherent AML risk:** The point where financial crime becomes visible — missed alerts enable layering and integration. High volumes risk fatigue-driven errors. Delays in escalation breach regulatory timeframes.
- **Risk profile:** AML: High | Sanctions: Medium | Fraud: Medium | Documentation: High | Escalation: High
- **Training depth:** Intermediate-Advanced. Alert review process, SAR writing, typology recognition, case documentation standards.

### Role 4: AML DDI Manager (2LoD — management)
- **What they do:** Manage KYC/AML searches on delivery partners and suppliers. Oversee periodic reviews. Maintain the data asset register (GDPR). Coach and quality-check analyst team. Report to Senior Manager.
- **Inherent AML risk:** Oversight failures allow lapsed or non-compliant partners to remain active. GDPR mismanagement creates dual regulatory exposure. Errors propagate across the analyst team they supervise.
- **Risk profile:** AML: High | Sanctions: High | Fraud: Low | Documentation: High | Escalation: Medium
- **Training depth:** Advanced-Intermediate. Third-party risk management, GDPR/AMLR intersection, quality assurance, team accountability.

### Role 5: MLRO — Money Laundering Reporting Officer (2LoD — senior)
- **What they do:** Ultimate accountability for SAR submission decisions. Oversees the entire financial crime framework. Provides Board-level reporting. External-facing to regulators and law enforcement. Designs F&FC policy.
- **Inherent AML risk:** Personal criminal liability for wrong SAR decisions. Blind spots at this level cascade across all defences. Inaccurate MI leads to flawed Board decisions. Highest regulatory and reputational exposure.
- **Risk profile:** AML: Critical | Sanctions: Critical | Fraud: High | Documentation: High | Escalation: Critical
- **Training depth:** Advanced/Strategic. SAR accountability, regulatory reporting, Board communication, policy design, enforcement engagement.

---

## 4. THE AI PIPELINE — STEP BY STEP

This is the complete workflow the product executes. The AI handles steps 1–5 and 7. Humans act at steps 3H, 4H, and 6.

```
INPUT: Role description (free text or structured)
         │
         ▼
[STEP 1] Role Import
         Extract: title, duties, reporting line, management responsibility, line of defence
         │
         ▼
[STEP 2] Role Analysis — Who is this person?
         Output: role function summary, LoD classification, key decisions they make,
                 what happens if they make a mistake
         │
         ▼
[STEP 3] Risk Assessment — What risk do they carry?
         Output: risk matrix — score each of 5 dimensions with a one-sentence justification
         │
         ▼
[3H] ── HUMAN CHECKPOINT ── Compliance officer reviews and may override any risk score
         │
         ▼
[STEP 4] AMLR Article Mapping — What regulation applies?
         Output: for each relevant AMLR article, state why it applies and what obligation it creates for this role
         │
         ▼
[4H] ── HUMAN CHECKPOINT ── Legal/compliance confirms article mapping is accurate
         │
         ▼
[STEP 5] Training Path Generation — What should they learn and when?
         Output: 4-quarter plan (Q1–Q4), 5–7 modules per quarter
         Each module includes: name, quarter, duration, risk dimension, AMLR article, WHY it was included
         │
         ▼
[STEP 6] ── HUMAN APPROVAL GATE ── Compliance manager reviews, edits, and approves the plan
         │
         ▼
[STEP 7] LMS Assignment View
         Output: table of modules with assignee, due date, and completion status
         │
         ▼
OUTPUT: Documented, audit-ready, AMLR-compliant training plan per role
```

---

## 5. AMLR ARTICLES THAT DRIVE TRAINING OBLIGATIONS

These are the specific EU regulation articles the system maps to. Reference them by number and name in all outputs.

| Article | Title | Training obligation |
|---------|-------|-------------------|
| **Article 9** | Scope of internal policies, procedures and controls | Obliged entities must have documented AML/CTF training policies. The compliance manager must approve procedures. Staff must be covered. |
| **Article 10** | Business-wide risk assessment | Risk assessment must be documented, kept up to date, and available to supervisors. Drives what training each role needs. |
| **Article 11** | Compliance functions | Compliance officer must have sufficient resources and authority. Must report directly to the management body. Cannot be unduly influenced by commercial interests. |
| **Article 12** | Awareness of requirements | **Core training article.** Staff must participate in specific, ongoing training appropriate to their functions and to the ML/TF risks they face. Training must be duly documented. |
| **Article 13** | Integrity of employees | Staff in AML roles must undergo skills, knowledge, and integrity assessments before taking up activities, and regularly thereafter. Conflicts of interest must be managed. |

---

## 6. EXACT OUTPUT SCHEMA

When the AI generates a training plan, it must follow this structure. Build your data model around this.

### Risk Matrix output (Step 3)
```json
{
  "role_title": "KYC Analyst",
  "line_of_defence": "1LoD",
  "risk_matrix": [
    {
      "dimension": "AML Risk",
      "score": "High",
      "justification": "Handles the bank's highest-risk customers using professional judgement; flawed analysis allows illegitimate customers to go undetected."
    },
    {
      "dimension": "Sanctions Risk",
      "score": "High",
      "justification": "Must screen clients against global sanctions lists and PEP databases; missed matches create direct regulatory exposure."
    },
    {
      "dimension": "Fraud Risk",
      "score": "Medium",
      "justification": "Involved in identity verification but not directly in transaction authorisation; fraud risk is indirect."
    },
    {
      "dimension": "Documentation Risk",
      "score": "High",
      "justification": "Must produce auditable risk rationales; poor documentation directly weakens the regulatory audit trail."
    },
    {
      "dimension": "Escalation Risk",
      "score": "High",
      "justification": "Failure to escalate suspicious indicators to the MLRO directly causes a regulatory breach under AMLR Article 12."
    }
  ]
}
```

### AMLR Mapping output (Step 4)
```json
{
  "role_title": "KYC Analyst",
  "amlr_mappings": [
    {
      "article": "Article 9",
      "article_name": "Scope of internal policies, procedures and controls",
      "applies_because": "This role must operate within and implement the firm's documented KYC/CDD procedures.",
      "training_obligation": "Must understand and follow the firm's internal AML policies and CDD standards."
    },
    {
      "article": "Article 12",
      "article_name": "Awareness of requirements",
      "applies_because": "This is a high-risk AML function requiring specific, ongoing training appropriate to the ML/TF risks this role faces.",
      "training_obligation": "Must complete role-specific, documented training covering EDD, typologies, and escalation — updated regularly."
    },
    {
      "article": "Article 13",
      "article_name": "Integrity of employees",
      "applies_because": "This role directly participates in the firm's AML/CFT compliance and must be assessed for skills, knowledge, and integrity.",
      "training_obligation": "Must undergo skills and integrity assessment before taking up activities and at regular intervals thereafter."
    }
  ]
}
```

### Training Plan output (Step 5)
```json
{
  "role_title": "KYC Analyst",
  "training_philosophy": "Year 1 builds foundation and assessed competency. Years 2-4 maintain through annual refreshers and specialist development.",
  "quarters": [
    {
      "quarter": "Q1",
      "name": "Foundation",
      "months": "Months 1-3",
      "modules": [
        {
          "module_name": "AML/CTF Fundamentals and AMLR Overview",
          "duration_hours": 4,
          "risk_dimension": "AML Risk",
          "amlr_article": "Article 12",
          "why_included": "Article 12 requires training appropriate to the ML/TF risks this role faces. As a KYC Analyst handling high-risk customers, foundational AML literacy is the non-negotiable starting point."
        },
        {
          "module_name": "Enhanced Due Diligence (EDD) Standards and Case Handling",
          "duration_hours": 6,
          "risk_dimension": "AML Risk",
          "amlr_article": "Article 12",
          "why_included": "This role's primary function is EDD on high-risk customers. Without deep EDD knowledge, the role cannot fulfil its core regulatory function."
        },
        {
          "module_name": "Source of Funds and Source of Wealth Assessment",
          "duration_hours": 3,
          "risk_dimension": "AML Risk",
          "amlr_article": "Article 12",
          "why_included": "EDD requires confirmation of SoF and SoW for high-risk customers. This is a mandatory analytical skill for this role."
        }
      ]
    },
    {
      "quarter": "Q2",
      "name": "Application",
      "months": "Months 4-6",
      "modules": []
    },
    {
      "quarter": "Q3",
      "name": "Deepening",
      "months": "Months 7-9",
      "modules": []
    },
    {
      "quarter": "Q4",
      "name": "Embedding",
      "months": "Months 10-12",
      "modules": []
    }
  ]
}
```

---

## 7. HUMAN-IN-THE-LOOP DESIGN RULES

The system must enforce these three human gates. Without them the product is not "human-in-the-loop" and loses a significant part of its score.

| Gate | After step | Who acts | What they can do | What happens next |
|------|-----------|----------|-----------------|------------------|
| **Gate 1 — Risk Review** | Step 3 | Compliance officer | Override any risk score. Add a note explaining why. | AI regenerates AMLR mapping and training plan using the corrected scores. |
| **Gate 2 — AMLR Review** | Step 4 | Legal/compliance | Add or remove article mappings. Flag incorrect justifications. | AI regenerates the training plan for the corrected mapping. |
| **Gate 3 — Training Approval** | Step 5 | Compliance manager | Add, remove, or reorder modules. Edit justifications. Change quarter assignments. | Must explicitly approve before anything moves to the LMS assignment step. |

**Important:** The system must make the AI's reasoning visible at each gate. The human must see WHY the AI made each recommendation before they can approve it.

---

## 8. HOW THE JURY EVALUATES THE PRODUCT

Build to these in order of weight. The highest-weight criterion should be the most visible feature in your demo.

| Weight | Criterion | What you must demonstrate |
|--------|-----------|--------------------------|
| **25%** | Risk-Role-Competency Link & Explainability | Every training module shows: which risk score triggered it, which AMLR article mandates it, and what competency gap it closes. This justification must be visible in the UI. |
| **20%** | Regulatory Relevance | All AMLR article references are accurate and traceable to the actual regulation text. Never invent obligations. |
| **15%** | Automation Degree | From role import to training plan draft: zero manual input required from the user. The full pipeline runs automatically until the first human gate. |
| **15%** | Proprietary / Hard to copy | The risk-to-training logic, the AMLR mapping layer, and the explainability engine are the unique IP. Emphasise this in your demo narrative. |
| **10%** | Ease of Use | A compliance manager who has never seen the product should reach a draft training plan in under 5 minutes with no training. |
| **10%** | LMS Functionality | Show modules assigned to roles/people, with status (not started / in progress / completed) and due dates. Does not need to be a full LMS — a clean table view is sufficient. |
| **5%** | Business Relevance | Frame the problem in terms a CCO understands: AMLR 2027 deadline, cost of non-compliance, audit-readiness, and the failure of generic training. |

---

## 9. SYSTEM PROMPT — PASTE THIS INTO THE AI MODEL POWERING THE PIPELINE

Use this as the `system` message in every API call. It gives the AI the domain knowledge, output format, and the critical explainability rule.

```
You are a senior AML compliance training architect. Your job is to analyse job role descriptions
from regulated financial institutions and generate role-specific, risk-based compliance training
plans that comply with EU Regulation 2024/1624 (AMLR).

DOMAIN KNOWLEDGE
You understand AML, KYC, CDD, EDD, PEP screening, SAR reporting, transaction monitoring,
sanctions screening, and the distinction between first-line-of-defence (operational) and
second-line-of-defence (oversight) roles. You know the difference between inherent risk
(what the role carries by nature of its function) and residual risk (after controls).

REGULATORY FRAMEWORK
The primary regulation is AMLR 2024/1624. The most relevant articles are:
- Article 9: Internal policies, procedures, and controls must be documented and staff-covered
- Article 10: Business-wide risk assessment must be documented and regularly reviewed
- Article 11: Compliance officer must have sufficient resources and direct board access
- Article 12: Training must be specific, ongoing, appropriate to the role's functions and risks, and documented
- Article 13: Staff in AML roles must be assessed for skills, knowledge, and integrity before starting and regularly thereafter

RISK DIMENSIONS
Score every role across five dimensions on a Low / Medium / High / Critical scale:
1. AML Risk — risk of facilitating money laundering through this role's activities
2. Sanctions Risk — risk of transacting with sanctioned parties
3. Fraud Risk — risk of enabling or missing fraud
4. Documentation Risk — risk that poor record-keeping weakens the audit trail
5. Escalation Risk — risk that suspicious activity is not escalated in time

TRAINING STRUCTURE
All plans follow a 4-quarter annual format:
Q1 Foundation: core knowledge, regulatory framework, role-specific awareness
Q2 Application: practical skills, independent work, peer review
Q3 Deepening: advanced typologies, specialist workshops, cross-team collaboration
Q4 Embedding: regulatory updates, full competency assessment, year 2 planning

OUTPUT RULES
1. Every training module MUST include a justification field explaining why it was assigned
   to this specific role. Reference the exact risk dimension and AMLR article that drive it.
2. Never assign a module without a justification. Explainability is the core value of this product.
3. Frame all outputs as proposals for human review — a compliance officer will approve before anything is assigned.
4. Use precise compliance terminology: EDD not "detailed checks", SAR not "report", MLRO not "compliance manager".
5. When uncertain about a regulatory mapping, state your reasoning and flag it for human review.
```

---

## 10. TECH CONTEXT FOR THE BUILDER

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM API | OpenRouter (provided) — use with your own Anthropic API key as fallback | $50 credits provided for hackathon |
| Language | JavaScript / TypeScript (Node.js backend, React frontend) | Standard full-stack for rapid prototyping |
| Data flow | Separate API call per pipeline step | Allows human gates between steps; clear audit log |
| Storage | In-memory or localStorage for demo | No database needed for hackathon scope |
| Demo format | Video link (YouTube or similar), 5 minutes max | Jury requirement — no file uploads accepted |
| Demo structure | Start with: who is the user, what are they trying to do | Jury evaluates based on user success, not features |

### Recommended component structure
```
/app
  /components
    RoleImport.jsx          ← Step 1-2: paste/upload role, show extracted profile
    RiskMatrix.jsx          ← Step 3: show 5-dimension risk scores with justifications
    RiskReviewGate.jsx      ← Gate 1: human override interface for risk scores
    AMLRMapping.jsx         ← Step 4: show which articles apply and why
    AMLRReviewGate.jsx      ← Gate 2: human confirmation of article mapping
    TrainingPlan.jsx        ← Step 5: 4-quarter plan with module cards
    TrainingApprovalGate.jsx ← Gate 3: human edit and approve interface
    LMSView.jsx             ← Step 7: assignment table with status tracking
    ExplainabilityPanel.jsx ← Reusable: shows WHY for any AI recommendation
```

---

## 11. EXAMPLE AI PROMPT PATTERNS

Copy these patterns when building each pipeline step.

### Step 2 — Role analysis
```
[SYSTEM PROMPT FROM SECTION 9]

USER: Analyse this role description and produce a structured role profile.
Extract: role title, line of defence (1LoD or 2LoD), summary of daily activities,
key decisions this person makes, and what the consequence is if they make a wrong decision.

ROLE DESCRIPTION:
[PASTE ROLE DESCRIPTION HERE]
```

### Step 3 — Risk assessment
```
[SYSTEM PROMPT FROM SECTION 9]

USER: Given this role profile, produce a risk matrix.
Score each of these 5 dimensions on Low / Medium / High / Critical:
AML Risk, Sanctions Risk, Fraud Risk, Documentation Risk, Escalation Risk.
For each score provide one sentence explaining why this role carries that level of risk.

ROLE PROFILE:
[PASTE STEP 2 OUTPUT HERE]
```

### Step 4 — AMLR mapping
```
[SYSTEM PROMPT FROM SECTION 9]

USER: Given this role profile and risk matrix, identify which AMLR 2024/1624 articles
impose training obligations relevant to this role. For each article state:
1. The article number and title
2. Why it applies to this specific role
3. What specific training obligation it creates

Focus on Articles 9, 10, 11, 12, and 13.

ROLE PROFILE AND RISK MATRIX:
[PASTE STEP 2 AND 3 OUTPUTS HERE]
```

### Step 5 — Training plan generation
```
[SYSTEM PROMPT FROM SECTION 9]

USER: Generate a 4-quarter (Q1-Q4) training plan for this role.
Include 5-7 modules per quarter following this structure:
- Q1 Foundation (months 1-3): core knowledge and awareness
- Q2 Application (months 4-6): practical skills and independent work
- Q3 Deepening (months 7-9): advanced topics and specialist knowledge
- Q4 Embedding (months 10-12): assessment, regulatory updates, year 2 planning

For each module provide:
- Module name
- Estimated duration in hours
- Which risk dimension it addresses
- Which AMLR article mandates or supports it
- One sentence explaining WHY this module is assigned to this role specifically

ROLE PROFILE, RISK MATRIX, AND AMLR MAPPING:
[PASTE ALL PREVIOUS OUTPUTS HERE]
```

---

*End of context brief. Begin building.*
