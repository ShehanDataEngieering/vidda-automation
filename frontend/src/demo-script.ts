/**
 * Demo script for the hackathon — KYC Analyst happy path.
 * 
 * Paste this exact role description into the Role Import screen during the demo.
 * It's drawn from vidda_AI_context_brief.md Section 3, Role 2.
 */

export const DEMO_ROLE_DESCRIPTION = `KYC Analyst — Enhanced Due Diligence Specialist

What they do:
Conduct Enhanced Due Diligence on high-risk customers. Validate complex ownership structures up to the ultimate beneficial owner. Assess Source of Funds and Source of Wealth for politically exposed persons and clients in high-risk jurisdictions. Perform periodic reviews of existing high-risk client relationships. Escalate suspicious indicators to the MLRO via the internal SAR submission process. Document risk rationales for every client file.

Daily activities:
- Receive EDD cases from the onboarding team when a client triggers enhanced checks
- Review corporate ownership structures to identify beneficial owners holding 25% or more
- Screen clients against global sanctions lists, PEP databases, and adverse media
- Request and validate Source of Funds and Source of Wealth documentation
- Write risk assessment narratives documenting the CDD analysis and decision
- Perform periodic reviews of existing high-risk clients every 12 months
- Escalate accounts with suspicious indicators to the MLRO within 24 hours

Key decisions this person makes:
- Accept or reject a client's EDD documentation as sufficient
- Classify a client's risk tier (standard, elevated, high, prohibited)
- Flag beneficial owners for further investigation
- Recommend account closure where risk is unmanageable

What happens if they make a mistake:
- Illegitimate high-risk customers enter the bank undetected
- The bank faces regulatory fines for CDD failures under AMLR 2024/1624
- Suspicious activity proceeds without SAR reporting — a criminal offence
- The audit trail is compromised, making regulatory inspection impossible`;

/**
 * Demo timing (5 minutes total):
 * 
 * 0:00 — "Compliance manager Sarah at Nordic Bank needs to train her KYC team for AMLR 2027 deadline"
 * 0:30 — Paste the role description above → "Analyse Role"
 * 0:50 — AI: "Classified as KYC Analyst (92% confidence)" — show profile card
 * 1:15 — Risk matrix: 5 dimensions scored with justifications
 * 1:35 — Override Fraud Risk Medium→High, add note "KYC handles high-risk PEPs — fraud exposure is higher"
 * 1:50 — AMLR Articles 9, 12, 13 mapped with RAG-verified text
 * 2:15 — Confirm AMLR mapping
 * 2:30 — SSE stream: 4-quarters, ~6 modules per quarter
 * 3:30 — Click module → "why_included" + risk badge + AMLR article badge (THE MONEY SHOT)
 * 3:50 — Edit one module, remove another, "Approve Plan"
 * 4:10 — LMS: assign to KYC team members, set due dates
 * 4:30 — Click module → audit trail: AI generated → Sarah overrode → final approval
 * 4:40 — "Vidda Index auto-absorbs AMLA 2026 guidelines. Continuous regulatory update."
 * 4:55 — "Audit-ready. AMLR-compliant. 4 minutes from role description to assigned plan."
 */
