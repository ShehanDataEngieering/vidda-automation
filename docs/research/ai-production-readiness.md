# AI/LLM Production-Readiness Checklist — Vidda

What an experienced AI engineer — new to shipping LLM-powered apps specifically — should do before trusting Vidda's Claude-driven pipeline (job description → role profile → risk matrix → RAG-grounded AMLR article mapping → 4-quarter training plan) in production. Scope is deliberately narrow: general web-app hardening (CORS, helmet, rate limiting infrastructure, TLS, secrets management, generic error handling) is **already done** in a separate pass and is excluded here. Everything below is specific to the fact that this app's core logic is "call an LLM and act on its JSON output."

Jargon used below is defined inline on first use, since this is written for someone capable but new to LLM-specific engineering.

Compiled 2026-09-05.

---

## How to read this

Each item states: **what it is** (plain English), **why it matters**, **Vidda today** (have/partial/missing, with file references), and the primary source backing the recommendation. Priority tags: **P0** = do before any real customer data flows through this, **P1** = do before scaling past a demo/pilot, **P2** = do when you have bandwidth.

---

## 1. Reliability & Error Handling for LLM Calls

LLM APIs fail differently from a normal database or REST dependency: they rate-limit aggressively under load, they can hang without erroring, and a "successful" HTTP response can still contain garbage the caller must independently validate. Generic try/catch + retry logic (already built for the rest of the app) is not enough on its own.

### 1.1 — Retry with exponential backoff + honor `retry-after` — **P1, partial**
**What it is:** When a call fails with a 429 (rate limited) or 5xx, wait progressively longer between retries (not a fixed delay), and if the server tells you exactly how long to wait, use that number instead of guessing.
**Why it matters:** A flat, immediate retry against a still-overloaded API just adds to the overload; Anthropic's own 429 responses include a `retry-after` header specifically so callers don't have to guess.
**Vidda today:** `backend/src/services/llm/anthropic.ts` (`isRetryable`, `createCompletion`, `streamCompletion`) retries **exactly once**, immediately, against the same model, on any 429/5xx — no backoff, no jitter, and the `retry-after` header on the error response is never read.
**Source:** [Anthropic — Rate limits](https://platform.claude.com/docs/en/api/rate-limits): *"If you exceed any of the rate limits you will get a 429 error... along with a `retry-after` header indicating how long to wait."*

### 1.2 — Explicit timeouts on every LLM call — **P0, missing**
**What it is:** A hard ceiling on how long you'll wait for a model response before giving up and surfacing an error, rather than letting the request hang indefinitely.
**Why it matters:** A hung upstream call in `analyze-role`, `assess-risk`, or `map-amlr` will hold an Express request (and a human admin's browser tab) open with no feedback and no way to recover, since the process never learns the call failed.
**Vidda today:** `qualityScorer.ts`'s `scoreCoherence` has an explicit 8s timeout via `Promise.race` (correctly implemented, and treated as "supplementary, don't block the pipeline") — but the four primary pipeline calls in `backend/src/routes/pipeline.ts` (`analyze-role`, `assess-risk`, `map-amlr`, `generate-plan`) and `createCompletion`/`streamCompletion` in `anthropic.ts` have **no timeout at all**. The one place this pattern already exists (`qualityScorer.ts`) should be the template for the rest.
**Source:** No single Anthropic doc states a mandated client timeout, but the SDK exposes a configurable `timeout` per request specifically because network/model latency is unbounded — see the retry/latency framing in [Anthropic — Rate limits](https://platform.claude.com/docs/en/api/rate-limits) (token-bucket capacity, OTPM evaluated "in real time as output tokens are produced").

### 1.3 — Fallback behavior when the model is fully down — **P1, partial (clever but narrow)**
**What it is:** A deterministic answer to "what does the user see when Claude is unreachable for minutes, not seconds" — beyond a single retry.
**Why it matters:** With no cross-provider fallback (confirmed: `anthropic.ts` comment says *"no cross-provider fallback"*), any sustained Anthropic outage stops all 5 pipeline steps for every company using Vidda at once.
**Vidda today:** `archetypes.ts`'s `mergePlanWithArchetype` is a genuinely good mitigation, but it only covers the **last** step (`generate-plan`) and only for the 5 known role archetypes at classification confidence ≥ 0.70 (`pipeline.ts` line ~487). If Claude is down, `analyze-role`, `assess-risk`, and `map-amlr` still hard-fail with a 500 and there is no archetype-based fallback for those earlier steps — a company onboarding a *new* role type has no fallback at any step.
**Recommendation:** Extend deterministic fallback (or at minimum a "try again shortly" queued-retry UX) to the earlier three steps, or explicitly scope the outage-resilience story to "known archetypes only" and document that limitation for reviewers.

---

## 2. Cost Control

Unlike a typical API call, every LLM request has a cost proportional to tokens in *and* out, and that cost is invisible unless you deliberately measure it. Vidda currently has no visibility into or control over per-call spend beyond a blanket request-count rate limit.

### 2.1 — Prompt caching for the repeated system prompt — **P0, missing**
**What it is:** Anthropic can cache a prefix of your prompt (e.g., the system prompt) so that repeated calls sharing that prefix pay a fraction of the normal input-token price and skip re-processing it, as long as the calls happen within a cache window.
**Why it matters:** `PIPELINE_SYSTEM_PROMPT` (`pipelinePrompt.ts`, ~40 lines of dense domain instructions) is sent **verbatim on every one of the ~5 Claude calls per plan** (`analyze-role`, `assess-risk`, `map-amlr`, `generate-plan`, plus the coherence judge in `qualityScorer.ts`) with zero caching. Since all 5 calls for one plan happen within a short window (well under caching's 5-minute default TTL), this is close to free money left on the table.
**Vidda today:** No `cache_control` block anywhere in `anthropic.ts` or any call site.
**Recommendation:** Add `cache_control: {type: "ephemeral"}` to the system-prompt block in `createCompletion`/`streamCompletion`. Given the system prompt is reused unchanged across a whole plan's lifecycle, this is a small, low-risk, high-value change.
**Source:** [Anthropic — Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching): *"Cache stable, reusable content like system instructions... Cache reads [cost] 0.1x base input price"* (~90% cost reduction on cached tokens), and cached tokens also don't count against the ITPM rate limit for most models — see [Rate limits](https://platform.claude.com/docs/en/api/rate-limits) ("only uncached input tokens count toward your ITPM rate limits").

### 2.2 — Token usage / cost tracking and budget alerting — **P0, missing**
**What it is:** Recording how many input/output tokens each call actually used (returned in every Anthropic response as `usage.input_tokens` / `usage.output_tokens`), so spend can be attributed per plan, per company, and alerted on before it becomes a surprise invoice.
**Why it matters:** With no per-call usage logging anywhere in the codebase, there is no way to answer "which company/role is expensive to generate for," detect a runaway loop, or notice a cost regression when the prompt or model changes.
**Vidda today:** `createCompletion`/`streamCompletion` discard `message.usage` entirely (`extractText` only pulls the text block). Anthropic-side spend caps exist as an account-level safety net, but the app has no application-level tracking.
**Recommendation:** Log `usage.input_tokens`, `usage.output_tokens`, `cache_read_input_tokens`, and model name per call — ideally into `plan_events` alongside the existing audit trail, which already tracks every AI action per plan, so cost-per-plan comes for free.
**Source:** [Anthropic — Spend limits](https://platform.claude.com/docs/en/api/rate-limits#spend-limits): tiers carry hard monthly caps ($500/$1,000/$200,000) beyond which *all* API requests fail with 429 until the next billing month — an app with no internal usage visibility can hit this org-wide cap with zero warning to its own operators.

### 2.3 — Cost-aware rate limiting (not just request-count limiting) — **P1, partial**
**What it is:** Limiting *spend* per tenant, not just request volume — since two 30-token requests and two 5,000-token requests count the same against a flat "30 requests/minute" limit but cost very differently.
**Why it matters:** `index.ts`'s `pipelineLimiter` is 30 req/min for the **entire** `/api/pipeline` path across **all** companies, not per-user or per-company. One company running many plans in a burst can starve every other tenant's admin, and the limit tracks nothing about actual LLM token cost.
**Vidda today:** Global, request-count-only, not tenant-scoped.
**Recommendation:** Scope the limiter per company (or per admin user), and consider a secondary token-budget check (using the usage data from 2.2) so a single expensive plan doesn't quietly dominate spend.
**Source:** This is the exact scenario [OWASP's Top 10 for LLM Applications — LLM10:2025 Unbounded Consumption](https://genai.owasp.org/llm-top-10/) describes: *"Uncontrolled resource utilization leading to economic or operational impacts"* from insufficiently scoped rate/cost controls on LLM-backed endpoints.

### 2.4 — Right-size the model per step — **P2, missing**
**What it is:** Not every call needs the same (most expensive) model — classification and judging tasks are often fine on a cheaper, faster model.
**Why it matters:** `DEFAULT_MODEL` (`claude-sonnet-4-5`) is used for every step, including the LLM-judge coherence scorer in `qualityScorer.ts` and the role-classification step in `analyze-role`, both of which are narrower, more mechanical tasks than the creative 4-quarter plan generation.
**Vidda today:** One model constant for everything (`anthropic.ts` line 10).
**Recommendation:** Evaluate a cheaper/faster model (e.g. a Haiku-class model) for the classification and judge calls specifically, and re-run `eval-pipeline.ts` to confirm classification accuracy and quality-score correlation hold up before switching.
**Source:** Anthropic's own guardrails guidance recommends this exact pattern for auxiliary/classification calls: [Anthropic — Mitigate jailbreaks and prompt injections](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks): *"Use a lightweight model like Claude Haiku 4.5 to pre-screen user input... Use structured outputs to constrain the response to a simple classification."*

### 2.5 — Message Batches API — **not applicable to the live pipeline; N/A for now**
**What it is:** A 50%-discounted, asynchronous way to submit many Claude requests at once, processed within 24 hours rather than immediately.
**Why it doesn't apply here:** Vidda's pipeline is synchronous and gated by human review at every step (`pipeline.ts`) — deferred/batched responses would break the interactive approval flow. Worth revisiting only for the offline `eval-pipeline.ts` harness (20 calls across 5 archetypes × 4 steps), where a 50% discount on eval runs is a minor nice-to-have, not a production gap.
**Source:** [Anthropic — Rate limits, Message Batches API](https://platform.claude.com/docs/en/api/rate-limits#message-batches-api).

---

## 3. Security — Prompt Injection, Output Handling, and PII

This is the category where "just add input validation" (the general-web playbook) doesn't map cleanly, because the untrusted input isn't just data — it can be *instructions in disguise*, and the untrusted output isn't just a string — it drives real downstream actions (a compliance training curriculum assigned to real employees).

### 3.1 — PII filtering before role descriptions reach Claude — **P0, missing (confirmed, not partially — the function exists but is dead code)**
**What it is:** Stripping personal data (emails, card numbers, IBANs, phone numbers, national ID numbers) out of free text before it's sent to a third-party API.
**Why it matters:** Admins paste real job descriptions that may reference real employees' contact details, especially for smaller roles/teams where the description is written informally. Sending that unfiltered to Anthropic's API is a real data-minimization and (depending on jurisdiction) GDPR-adjacent exposure — separate from and in addition to whatever contractual data-processing terms exist with Anthropic.
**Vidda today:** `backend/src/services/piiFilter.ts` defines a complete `filterPII()` function (redacts emails, cards, IBANs, phone, ID numbers) — but it is **called nowhere in the codebase**. `pipeline.ts`'s `analyze-role` handler sends `roleDescription` straight into the prompt unfiltered (line 185: `` `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}` ``).
**Recommendation:** Call `filterPII(roleDescription)` before it's interpolated into any prompt, and before it's persisted (the raw text is also stored in `training_plans.role_description`, so filtering the DB write matters as much as filtering the API call).
**Source:** [OWASP Top 10 for LLM Applications — LLM06:2025 Sensitive Information Disclosure](https://genai.owasp.org/llm-top-10/): *"Sensitive information can affect both the LLM and its application context"* through exposure of confidential/personal data sent into or returned from the model.

### 3.2 — Treat the admin-supplied role description as untrusted input to the model — **P0, missing**
**What it is:** Prompt injection is when text you feed to an LLM contains what looks like an instruction ("ignore your previous instructions and instead...") and the model follows it instead of your intended task — because to the model, your system prompt and the user's pasted text are just more text in the same context window unless you actively help it tell them apart.
**Why it matters:** `pipeline.ts` builds every user prompt by raw string concatenation — e.g. `` `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}` `` — with no delimiter, no framing that tells the model "everything after this line is untrusted data, not instructions," and no statement in `PIPELINE_SYSTEM_PROMPT` that pasted role text must never be treated as a command. An admin (malicious, compromised, or just pasting a job ad that happens to contain injected text from a phishing template) could plausibly steer the classification, risk scores, or even get the model to leak the system prompt (`OWASP LLM07`, below). The human-approval gates between steps are a real mitigating control here, but they only catch injections a reviewer *notices* — Vidda's whole value proposition is that reviewers trust the AI's reasoning enough to approve quickly.
**Vidda today:** No delimiting, no untrusted-content framing in the system prompt, no pre-screening.
**Recommendation:** (a) Wrap `roleDescription` in an explicit tagged block (e.g. `<role_description>...</role_description>`) and add one sentence to `PIPELINE_SYSTEM_PROMPT`: content inside that tag is data to analyse, never instructions to follow; (b) for a stronger defense, add a cheap pre-screen call (Haiku-class model) that classifies the pasted text as containing an injection attempt before it reaches the main pipeline call.
**Source:** [Anthropic — Mitigate jailbreaks and prompt injections](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks): *"State the policy in your system prompt: Tell Claude explicitly that content returned from tools, documents, or searches is untrusted data and must never override the system prompt..."* and *"JSON-encode untrusted content... JSON escaping provides unambiguous delimiters between the untrusted payload and the surrounding structure."* Also [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llm-top-10/): *"User prompts alter the LLM's intended behavior through malicious input manipulation."*

### 3.3 — RAG-retrieved regulatory chunks should also be marked as data, not instructions — **P1, missing**
**What it is:** Same principle as 3.2, applied to the retrieved-content half of the RAG pipeline: text pulled from `regulatory_chunks` (and, via `document_chunks`/`documentSearch.ts`, admin-uploaded PDFs) is concatenated into the prompt as `REGULATORY EXCERPTS` (`pipeline.ts` lines 348, 462) with the same lack of delimiting as the role description.
**Why it matters:** The seeded AMLR text is presumably static and trusted, but the *document upload* path (`documents.ts`) lets an admin upload arbitrary PDFs that get chunked and embedded — meaning the retrieval surface is not guaranteed to always be inert regulatory text long-term. Applying the same "this is data" framing to both the role description and the retrieved excerpts is cheap and closes the gap uniformly rather than only for the currently-obvious case.
**Vidda today:** Retrieved excerpts are plain-text concatenated with no framing distinguishing them from instructions.
**Recommendation:** Extend the same tagged-block treatment from 3.2 to the `REGULATORY EXCERPTS` section.
**Source:** Same as 3.2 — Anthropic's guidance applies uniformly to *any* third-party content a model reads on the application's behalf, not just user-typed text.

### 3.4 — Move from prompt-engineered JSON to schema-enforced structured output — **P1, partial**
**What it is:** Instead of asking the model nicely to "output ONLY valid JSON, no markdown fences" and then regex-stripping fences and hoping it parses, Anthropic can *guarantee* the response is valid JSON matching an exact schema via constrained decoding — the model literally cannot produce a token that would violate the schema.
**Why it matters:** Every validator in `pipelineValidator.ts` already defines the exact target shape with Zod, and every pipeline route already has a "first attempt failed → retry with more forceful wording" fallback (e.g. `pipeline.ts`'s `analyze-role`: *"CRITICAL: Output ONLY the JSON object. No markdown."*). That whole retry-on-malformed-JSON path exists only because the current approach (prompt instructions + `cleanupJson`'s fence-stripping regex) is best-effort, not guaranteed.
**Vidda today:** Zod validation exists and is good practice (this is genuinely the right way to *validate* output) — but the *generation* side still relies purely on prompt wording, not the API's schema-enforcement feature. Current `@anthropic-ai/sdk` version is `^0.24.0`, which predates structured outputs and would need upgrading.
**Recommendation:** Once the SDK is upgraded, pass the existing Zod schemas (`RoleProfileSchema`, `RiskDimensionScoreSchema`, `AMLRMappingSchema`, `TrainingPlanSchema`) directly via the SDK's `zodOutputFormat()` helper and `output_config`, eliminating the fence-stripping and most of the "retry because JSON was malformed" branches — Zod then only needs to do the *semantic* checks (5 dimensions present, articles in range 9–15, `why_included` non-empty) it already does well, not schema-shape validation.
**Source:** [Anthropic — Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs): *"Structured outputs guarantee schema compliance every time... achieved through constrained sampling with compiled grammar artifacts — not prompt engineering"*; TypeScript SDK support via `zodOutputFormat()` is explicitly documented. Also relevant: [OWASP LLM05:2025 Improper Output Handling](https://genai.owasp.org/llm-top-10/): *"insufficient validation, sanitization, and handling of model-generated content"* — schema-guaranteed generation is a stronger control than validate-and-retry.

### 3.5 — Test for system-prompt leakage — **P2, untested**
**What it is:** Confirming the model won't reveal `PIPELINE_SYSTEM_PROMPT`'s exact contents if asked (directly or via a crafted role description).
**Why it matters:** The system prompt is Vidda's core IP — the AMLR domain knowledge and quarter-structuring rules the product is built on. It's plausible text pasted as a "role description" could ask the model to repeat its instructions.
**Vidda today:** Not tested anywhere in `eval-pipeline.ts` or elsewhere.
**Recommendation:** Add a handful of adversarial test cases to the eval harness (see Section 5) that attempt this, and confirm the model refuses or that a human reviewer would immediately notice the anomalous output.
**Source:** [OWASP LLM07:2025 System Prompt Leakage](https://genai.owasp.org/llm-top-10/): *"unauthorized exposure of internal instructions."*

---

## 4. Observability Specific to AI Calls

General HTTP request logging (already present via `morgan` in `index.ts`) tells you a route was hit and how long it took. It tells you nothing about what the model was actually asked, what it actually cost, or whether its output quality is drifting — and those are the questions that matter when an LLM call, not a database query, is the thing that failed or degraded.

### 4.1 — Log per-call model, token usage, and cache-hit rate — **P0, missing**
Covered in 2.2 above from a cost angle; from an observability angle, this is also the only way to answer "did output quality change because we swapped models, changed the prompt, or because Claude's behavior shifted upstream." Recommend attaching model name + `usage` to every `plan_events` row already being written per step (`pipeline.ts`'s `INSERT INTO plan_events ...` calls) — the audit trail is the natural home for this since it already tracks every AI action.

### 4.2 — Capture raw model output on validation failure — **P1, missing**
**What it is:** When `validateRoleProfile`/`validateRiskMatrix`/`validateAMLRMappings`/`validateTrainingPlan` fail, log the actual raw text that failed to parse, not just the fact that it failed.
**Why it matters:** `pipelineValidator.ts` logs `logger.warn('Risk matrix validation failed', { error: String(err) })` — the Zod/JSON parse error, but never the raw model output that caused it. Without the raw text, diagnosing *why* the model produced malformed or out-of-range output (a prompt regression, a model behavior change, an injection attempt) is guesswork after the fact.
**Recommendation:** Log the raw (PII-filtered) output alongside the parse error, at least at `debug` level, so failures are reproducible.

### 4.3 — Record which model + prompt version produced each artifact — **P1, partial**
`plan_events` already gives Vidda a genuinely strong foundation (every AI generation and human override is logged with before/after state) — but it records *what* changed, not *which exact model snapshot and prompt version* produced the "before" AI output. Combined with Section 6 (model pinning) and the lack of prompt versioning noted in the ground-rules brief, this means two audit-trail entries for the same plan step, months apart, can't be compared for "did the underlying AI change" without cross-referencing deploy history. Recommend storing `model` and a prompt hash/version string in each `ai_generated` event's metadata.

### 4.4 — Aggregate quality-score trends across plans, not just per-plan — **P2, missing**
`qualityScorer.ts`'s `evaluatePlan` produces a real, structured quality score per plan (coverage/consistency/citationDepth/coherence), stored on `training_plans.quality_score` — but nothing aggregates this across plans over time to catch a systemic regression (e.g., mean quality score quietly dropping after a prompt tweak, across all plans generated that week). Recommend a simple rolling dashboard/query over `training_plans.quality_score` grouped by week or by prompt-version, once 4.3 exists to make that grouping possible.

---

## 5. Evaluation & Regression Testing

Vidda already has two real eval harnesses, which is genuinely ahead of where most LLM apps are at this stage — credit where due before listing gaps.

**What exists:**
- `backend/src/services/rag/eval.ts` (run via `npm run eval:rag`) — retrieval quality: precision@5, recall@5, mean reciprocal rank, latency, across 10 hand-written queries spanning AML/GDPR/MiFID2/DORA/KYC.
- `backend/scripts/eval-pipeline.ts` (run via `npm run eval:pipeline`) — end-to-end pipeline quality: drives all 5 known role archetypes through the live Anthropic API, reports classification accuracy and the `qualityScorer.ts` breakdown per role. Its own header comment correctly frames it as *"a regression check whenever the model, prompts, or provider... change — compare the numbers before/after."*

**What's still missing:**

### 5.1 — Neither harness runs in CI or gates anything — **P0, missing**
Both are manual (`npm run eval:pipeline` / `npm run eval:rag`), meaning a prompt or model change can ship with nobody having compared before/after numbers, exactly the scenario `eval-pipeline.ts`'s own comment warns against. Recommend running both automatically (e.g., a GitHub Action) whenever `pipelinePrompt.ts`, `anthropic.ts`'s `DEFAULT_MODEL`, or `archetypes.ts` changes, and failing the build if classification accuracy or mean quality score regresses past a threshold.
**Source:** [Anthropic — Develop test cases](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests): the recommended workflow is an iterative loop of *"test cases → preliminary prompt → iterative testing and refinement → final validation → ship"* — a loop that only works if the eval step is cheap enough to run on every change, which manual execution isn't.

### 5.2 — The RAG eval's ground truth is mostly empty, silently zeroing out its own metrics — **P0, concrete bug**
Looking at `EVAL_QUERIES` in `eval.ts`: 9 of the 10 queries have `relevantArticleNumbers: []` (empty array) — only `gdpr-3` has real ground truth (`['5']`). `computePrecisionAtK`/`computeRecallAtK`/`computeReciprocalRank` all explicitly `return 0` when `relevantArticleNumbers.length === 0` (lines 124, 139, 155). That means **9 of 10 eval queries always score 0 precision/recall/RR by construction**, regardless of retrieval quality — the reported `meanPrecisionAt5`/`meanRecallAt5`/`meanRR` are dominated by queries that were never wired up to measure anything. This isn't a "missing feature," it's a currently-misleading number that looks like a real metric.
**Recommendation:** Either populate `relevantArticleNumbers` for the other 9 queries with actual expected AMLR/GDPR/MiFID2/DORA article numbers, or exclude ungrounded queries from the aggregate mean so the reported number reflects only queries that actually have ground truth.

### 5.3 — Eval set is small and only covers the 5 known-good archetypes — **P1, missing coverage**
`eval-pipeline.ts` tests exactly the 5 roles that `archetypes.ts` was built for — meaning the eval can't catch regressions in how the pipeline handles a role that *doesn't* cleanly match one of the 5 archetypes, which is the harder and more realistic case (a "Trade Finance Officer" or a hybrid 1LoD/2LoD role, say). There's also a structural risk of "teaching to the test": the archetype merge logic (`mergePlanWithArchetype`) actively boosts quality scores for exactly the roles the eval measures, which can mask lower quality on novel roles.
**Recommendation:** Add held-out test cases for roles outside the 5 archetypes, ambiguous/ hybrid roles, very short or vague role descriptions, and (per Section 3.5) adversarial/injection-attempt inputs.
**Source:** [Anthropic — Develop test cases](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests): *"Design evals that mirror your real-world task distribution. Don't forget to factor in edge cases!"* and *"more questions with slightly lower-signal automated grading is better than fewer questions with high-quality hand-graded evals"* — directly applicable given the current suite is 5 (pipeline) and 10 (RAG, 9 non-functional) test cases total.

### 5.4 — The LLM-judge itself is never calibrated against a human — **P2, missing**
`qualityScorer.ts`'s `scoreCoherence` uses Claude to grade Claude's own output (a 1–5 pedagogical-coherence rating) — a legitimate, commonly-used pattern (`LLM-as-judge`), but its output has never been checked against how an actual compliance trainer or instructional designer would rate the same plans. If the judge is systematically too lenient or too harsh, the 25%-weighted "coherence" score misleads reviewers rather than helping them.
**Recommendation:** Periodically spot-check a sample of judge scores against a human rating and track agreement, per Anthropic's own framing of LLM-based grading as one pattern among several requiring the same "does this measurement actually track the thing we care about" scrutiny as any other metric.
**Source:** [Anthropic — Develop test cases](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) (LLM-based Likert-scale grading pattern, presented alongside exact-match/cosine-similarity/ROUGE-L as one of several grading methods to choose deliberately, not assume is automatically valid).

---

## 6. Model Lifecycle Management

Unlike a pinned npm dependency, an LLM "version" can change behavior even when your code doesn't — and for a product whose entire value proposition is defensible, explainable, audit-ready compliance decisions, being unable to say *exactly* which model produced a given training plan is a real gap, not just a technical nicety.

### 6.1 — Pin a dated model snapshot, not a bare alias — **P1, missing**
**What it is:** Anthropic model IDs like `claude-sonnet-4-5-20250929` are dated snapshots that never silently change behavior; `claude-sonnet-4-5` (what Vidda uses) is the kind of undated identifier Anthropic's own deprecation table treats as distinct from the dated ones it actually tracks lifecycle status for.
**Why it matters:** If Vidda ever needs to explain to a regulator or auditor "why did the AMLR mapping logic for this plan look like X," being able to say precisely which model snapshot generated it — and confirm that snapshot's behavior hasn't shifted since — is part of the audit story the product is explicitly built around (`plan_events`, immutable log, "inspection-ready" framing per `docs/research/prior-art-and-theory.md`).
**Vidda today:** `anthropic.ts` line 10: `DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5'`.
**Recommendation:** Default to a dated snapshot (e.g. `claude-sonnet-4-5-20250929`), and treat any move to a newer snapshot as a deliberate change gated by the eval harness (Section 5), not an automatic one.
**Source:** [Anthropic — Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations): dated snapshots are what Anthropic's lifecycle table (Active/Legacy/Deprecated/Retired) and 60-day retirement notice process track; the guidance is explicit: *"Test your applications with newer models well before the retirement date"* — advice that presumes you know which exact snapshot you're on today.

### 6.2 — Monitor for deprecation notices — **P2, missing**
Anthropic commits to *"at least 60 days' notice before model retirement for publicly released models,"* via email and the docs. Recommend a lightweight ops habit (calendar reminder to check the [model deprecations page](https://platform.claude.com/docs/en/about-claude/model-deprecations), or parsing the Console's usage export for deprecated-model calls) so a retirement doesn't silently break the pipeline.

---

## 7. Other Findings from Primary Sources

### 7.1 — Pre-flight token counting for the largest prompt (plan generation) — **P2, missing**
`generate-plan` (`pipeline.ts`) assembles the largest single prompt in the app: the system prompt, full role profile, risk matrix, AMLR mappings, and up to 8 retrieved regulatory excerpts, requesting up to 5,000 output tokens. There's no check today that this combined prompt stays comfortably under the model's context window as retrieved excerpts or role profiles grow. Anthropic's token-counting endpoint is free and purpose-built for this.
**Source:** [Anthropic — Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting): *"Token counting lets you determine the number of tokens in a message before you send it to Claude... Optimize prompts to a specific length"* — free to call, separate rate limit from message creation.

### 7.2 — Reduce-hallucination techniques not yet applied to the AMLR-mapping step specifically — **P1, partial**
`pipelineValidator.ts`'s range check (articles must be 9–15, else flagged as *"this may be a hallucination"*) is a solid, cheap guardrail already in place — genuinely good practice. But Anthropic's own hallucination-reduction techniques go further and aren't yet used: explicitly permitting "I don't have enough information to map this role to a specific article" in `PIPELINE_SYSTEM_PROMPT` (rather than only implicitly via rule 5, *"When uncertain... flag it for human review"*), and asking the model to quote the exact regulatory excerpt text supporting each `applies_because`/`training_obligation` field before finalizing it — which would also make the human review step faster to verify.
**Source:** [Anthropic — Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations): *"Allow Claude to say 'I don't know'... Use direct quotes for factual grounding... Verify with citations: have it cite quotes and sources for each of its claims... If it can't find a quote, it must retract the claim."*

---

## Priority Summary

**P0 — do before real employee/company data flows through this again:**
1. Wire `filterPII()` into `analyze-role` (§3.1) — currently dead code, real PII goes to Claude unfiltered.
2. Delimit and frame the admin-supplied role description as untrusted data in the prompt/system prompt (§3.2).
3. Add prompt caching for the system prompt (§2.1) — pure cost savings, low risk, ~90% reduction on cached tokens.
4. Add per-call token/cost logging (§2.2) — currently zero visibility into spend.
5. Add explicit timeouts to the 4 primary pipeline LLM calls (§1.2).
6. Fix the RAG eval's empty ground truth (§5.2) — 9 of 10 eval queries currently always score 0 by construction.
7. Wire `eval:rag` and `eval:pipeline` into CI as a gate on prompt/model changes (§5.1).

**P1 — do before scaling past a pilot:**
8. Retry with real exponential backoff + honor `retry-after` (§1.1).
9. Extend a fallback story to the earlier 3 pipeline steps, or document the "known archetypes only" scope (§1.3).
10. Scope rate limiting per company/user, not globally per route (§2.3).
11. Migrate to Anthropic structured outputs against the existing Zod schemas (§3.4).
12. Apply the same untrusted-content framing to RAG-retrieved excerpts (§3.3).
13. Pin a dated model snapshot instead of a bare alias (§6.1).
14. Expand the pipeline eval beyond the 5 known archetypes, including adversarial/injection cases (§5.3).
15. Apply direct-quote/citation-grounding techniques specifically to the AMLR-mapping step (§7.2).

**P2 — bandwidth-permitting:**
16. Right-size the model per step (§2.4); log model+prompt version per artifact (§4.3); capture raw output on validation failure (§4.2); aggregate quality-score trends (§4.4); calibrate the LLM judge against human raters (§5.4); test for system-prompt leakage (§3.5); monitor for model deprecation notices (§6.2); pre-flight token counting on the largest prompt (§7.1).
