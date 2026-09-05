# Prompt Caching — Should Vidda's Pipeline Use It?

Researched against primary sources only: Anthropic's official platform docs (`platform.claude.com/docs`), the `@anthropic-ai/sdk` TypeScript package as installed in this repo, and this repo's own source. No blog posts or secondary write-ups were consulted.

Compiled 2026-09-05.

---

## TL;DR

Vidda's pipeline (`backend/src/routes/pipeline.ts`) does **not** use prompt caching today (confirmed: `grep -rn "cache_control" backend/src` returns nothing). The shared system prompt (`PIPELINE_SYSTEM_PROMPT` in `backend/src/services/llm/pipelinePrompt.ts`) is only **≈857 tokens** — measured below — which is *under* the 1,024-token minimum cacheable prefix for the currently configured model (`claude-sonnet-4-5`). Caching the system prompt alone, as most guides show, **will silently do nothing on this model**. To get a real cache hit you need to combine the system prompt with each route's static instruction template (`ROLE_ANALYSIS_USER`, `RISK_ASSESSMENT_USER`, etc.) into one cached block. Concrete change shape is in [§ Recommendation](#recommendation). The dollar savings are small at today's traffic (~1–2¢ per full plan generation) because output tokens dominate this pipeline's cost — the main value is the "free" latency win once traffic exists, and it costs nothing to be wrong about the TTL choice.

---

## 1. How Anthropic prompt caching works (primary source)

Source: [Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md) and [Pricing](https://platform.claude.com/docs/en/about-claude/pricing.md), both on `platform.claude.com`.

- **Mechanism.** You mark a content block with `"cache_control": {"type": "ephemeral"}`. "Marking a block with `cache_control` writes exactly one cache entry: a hash of the prefix ending at that block." A later request whose prefix matches (byte-for-byte) reads from that entry instead of reprocessing it. — *Prompt Caching doc*
- **Render order / prefix rule.** The request is conceptually rendered `tools → system → messages`, and the cache key is the exact bytes of everything up to the breakpoint. **Any byte change anywhere in the prefix invalidates everything after it** — a timestamp, a re-ordered JSON key, a different tool list, all break the cache from that point on.
- **Two ways to place a breakpoint:**
  1. **Automatic** — a single top-level `cache_control` field on the request; the API places (and moves) the breakpoint on the last cacheable block for you.
  2. **Explicit** — `cache_control` on any specific content block (system text, message text, tool definitions, images, documents, tool_use/tool_result blocks) for fine-grained control. Up to **4 breakpoints per request**; a 5th explicit breakpoint returns a 400.
- **Lookback window.** Each breakpoint looks back at most 20 prior positions for a matching entry — not relevant to Vidda's single-turn calls (no multi-turn conversation), but matters if the pipeline is ever turned into a tool-using agent loop.
- **Minimum cacheable prefix — model-dependent, and not monotonic across generations** (*Prompt Caching doc*, table reproduced below):

  | Model family | Minimum prefix |
  |---|---:|
  | Claude Opus 5, Fable 5/5.1, Mythos 5/5.1 | 512 tokens |
  | **Claude Opus 4.8, Claude Sonnet 5, Sonnet 4.6, Sonnet 4.5, Opus 4.1, Opus 4** | **1,024 tokens** |
  | Opus 4.7, Mythos Preview, Haiku 3.5 | 2,048 tokens |
  | Opus 4.6, Opus 4.5, Haiku 4.5 | 4,096 tokens |

  *"Shorter prompts cannot be cached, even if marked with `cache_control`. Any requests to cache fewer than this number of tokens will be processed without caching, and no error is returned."* — this silent-failure behavior is the reason to always verify with the `usage` fields (§4), never assume a marker "worked."
- **TTL options.** `"ephemeral"` is currently the only cache type. Default lifetime is **5 minutes**; pass `"ttl": "1h"` for a 1-hour entry. *"The lifetime is measured from the start of the request that writes or reads the cache entry, not from the end of its response. Time spent generating a response counts against the lifetime."* A cache read refreshes the entry's timer at no extra cost, on either TTL.
- **Pricing multipliers** (relative to that model's base input-token price), from the official pricing table:

  | Operation | Multiplier | Applies to Vidda's model (Sonnet 4.5, $3/MTok base input) |
  |---|---:|---:|
  | 5-minute cache write | 1.25× | $3.75 / MTok |
  | 1-hour cache write | 2× | $6.00 / MTok |
  | Cache read (hit) | 0.1× | $0.30 / MTok |
  | (base input, for reference) | 1× | $3.00 / MTok |
  | (output, for reference) | — | $15.00 / MTok |

  Break-even: 5-min TTL pays for itself after **1 cache read** (1.25 + 0.1 = 1.35 vs. 2.0 for two uncached calls); 1-hour TTL needs **2 cache reads** to beat the plain 5-min approach (2.0 + 0.2 = 2.2 vs. 3.0 for three uncached calls).
- **Verification, not assumption.** The response `usage` object carries `cache_creation_input_tokens` (paid at the write multiplier), `cache_read_input_tokens` (paid at 0.1×), and `input_tokens` (the uncached remainder). *"If `cache_read_input_tokens` is zero across repeated identical-prefix requests, a silent invalidator is at work."* Given the borderline token-count situation below, this is not optional for Vidda — it's the only way to know caching is actually doing anything.

---

## 2. The TypeScript SDK shape (primary source: `@anthropic-ai/sdk` as installed)

`backend/node_modules/@anthropic-ai/sdk` is the real dependency in this repo (see `backend/package.json`). Its `messages.create()` accepts `system` either as a plain string (today's usage in `anthropic.ts`) or as an array of content blocks, each of which may carry `cache_control`:

```typescript
// Manual / explicit breakpoint — the one Vidda needs
const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 16000,
  system: [
    {
      type: "text",
      text: SOME_STATIC_TEXT,
      cache_control: { type: "ephemeral" },       // default 5 min
      // cache_control: { type: "ephemeral", ttl: "1h" },  // or 1h
    },
  ],
  messages: [{ role: "user", content: "..." }],
});

console.log(response.usage.cache_creation_input_tokens); // written this call
console.log(response.usage.cache_read_input_tokens);     // served from cache
console.log(response.usage.input_tokens);                // uncached remainder
```

`cache_control` can equally be placed on a `messages[].content[]` block instead of (or in addition to) `system`, which is the shape Vidda actually needs (§3).

---

## 3. What Vidda's code currently does (read in full)

**`backend/src/services/llm/anthropic.ts`** — the only call-site wrapper. Two exported functions, both build the same shape:

```typescript
const request = { model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user' as const, content: prompt }] };
```

`system` is a **plain string**, `prompt` is a **plain string** — no content-block arrays, no `cache_control` anywhere (`backend/src/services/llm/anthropic.ts:38,55`). `createCompletion` (non-streaming) and `streamCompletion` (SSE) are otherwise identical in shape. `DEFAULT_MODEL` is `claude-sonnet-4-5` unless `ANTHROPIC_MODEL` is set (`anthropic.ts:10`).

**`backend/src/services/llm/pipelinePrompt.ts`** — defines one shared system prompt and four *different* per-step user-prompt templates:

| Export | Used by (`pipeline.ts`) | Measured size (chars → ≈tokens @ 4 chars/token*) |
|---|---|---:|
| `PIPELINE_SYSTEM_PROMPT` | analyze-role, assess-risk, map-amlr, generate-plan (all four) | 3,429 chars ≈ **857 tokens** |
| `ROLE_ANALYSIS_USER` | `/:id/analyze-role` | 1,199 chars ≈ 300 tokens |
| `RISK_ASSESSMENT_USER` | `/:id/assess-risk` | 837 chars ≈ 209 tokens |
| `AMLR_MAPPING_USER` | `/:id/map-amlr`, `/:id/regenerate-amlr` | 597 chars ≈ 149 tokens |
| `TRAINING_PLAN_USER` | `/:id/generate-plan` | 3,904 chars ≈ 976 tokens |

*Anthropic's own FAQ gives "1 token is approximately 4 characters or 0.75 words in English" as the standard rough estimate (`platform.claude.com/docs/en/about-claude/pricing.md`, FAQ section) — used here because no live `ANTHROPIC_API_KEY` was available in this environment to call the exact `messages.count_tokens` endpoint. Treat these as estimates within roughly ±20%, not exact counts — confirm with `count_tokens` or the `usage` fields before relying on the threshold math below.

Confirming the task's premise about a shared prompt: **only 4 of the 5 pipeline LLM calls actually share `PIPELINE_SYSTEM_PROMPT`.** The 5th — the quality-scoring LLM judge — lives in `backend/src/services/llm/qualityScorer.ts` and uses its own, unrelated system prompt, `COHERENCE_PROMPT` (872 chars ≈ **218 tokens**, `qualityScorer.ts:132-150`), passed via the same `createCompletion` (`qualityScorer.ts:156-161`). It is well below every model's minimum cacheable prefix (512–4,096 tokens) and has no other static content to combine with — **not a caching candidate**, full stop.

**`backend/src/routes/pipeline.ts`** — how the per-step prompt is actually assembled. In every case, the static template and the variable, per-request data are concatenated into **one string** before being handed to `createCompletion`/`streamCompletion`, e.g.:

```typescript
// analyze-role, pipeline.ts:185
const userPrompt = `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}`;
```

```typescript
// map-amlr, pipeline.ts:348 — static template, then variable JSON, then RAG excerpts
const userPrompt = `${AMLR_MAPPING_USER}\n\nROLE PROFILE AND RISK MATRIX:\n${JSON.stringify(...)}\n\nREGULATORY EXCERPTS:\n${articleExcerpts}`;
```

This flattening is the reason caching can't be bolted on with a one-line `cache_control` today — the static and variable parts need to become two separate content blocks (§ Recommendation).

There's also a retry pattern that **actively defeats caching as currently written**. On invalid JSON, three of the four steps retry with the system prompt *mutated*:

```typescript
// pipeline.ts:196 (same pattern at :260 and :353)
system: PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON object. No markdown.',
```

Per §1's prefix rule, this is a **different string** from `PIPELINE_SYSTEM_PROMPT` alone — even with `cache_control` in place, this retry would never hit the cache the first attempt wrote; it would write a second, distinct cache entry instead. This needs to change as part of adding caching (§ Recommendation), independent of whether the fix is otherwise beneficial.

Separately, `createCompletion`'s and `streamCompletion`'s own transient-failure retry (`isRetryable`, on 429/5xx) resends the **exact same, unmodified `request` object** (`anthropic.ts:39-47`, `:58-75`) — this is cache-safe by construction, since it's byte-identical to the attempt that failed, so it never risks invalidating a cache entry the first attempt may have started writing.

---

## 4. Recommendation

### 4.1 — Where the breakpoint goes (the key finding)

Because `PIPELINE_SYSTEM_PROMPT` alone (≈857 tokens) sits **under** the 1,024-token minimum for `claude-sonnet-4-5`, putting `cache_control` on the system block by itself — the pattern shown in almost every caching example, including this skill's own README — **will not create a cache entry on this model**. Verify this claim yourself before trusting the recommendation below: it rests on a character-count estimate, not an exact tokenizer run.

The fix is to move the breakpoint later, onto the end of each route's **static instruction template**, so the cached prefix becomes `system + that route's static template` — comfortably over the minimum for three of four routes:

| Route | System + static template (≈tokens) | Clears 1,024 minimum? |
|---|---:|---|
| `/analyze-role` (+ `ROLE_ANALYSIS_USER`) | ≈1,157 | Yes, with margin |
| `/assess-risk` (+ `RISK_ASSESSMENT_USER`) | ≈1,066 | Yes, marginal |
| `/map-amlr`, `/regenerate-amlr` (+ `AMLR_MAPPING_USER`) | ≈1,006 | **Borderline — may or may not clear** |
| `/generate-plan` (+ `TRAINING_PLAN_USER`) | ≈1,833 | Yes, comfortable |

The AMLR-mapping route is the one to watch after deploying this — check `response.usage.cache_creation_input_tokens` on that route specifically; if it's consistently 0, that route just won't benefit without adding more static, shared text ahead of the variable role/risk JSON (the RAG excerpts can't be used for this since they vary per role).

### 4.2 — Concrete code shape

**`backend/src/services/llm/anthropic.ts`** — extend `CompletionParams` so callers can hand over a static (cacheable) part and a variable (never-cached) part separately, instead of one pre-concatenated `prompt` string:

```typescript
export interface CompletionParams {
  system: string;
  cachedPrefix?: string;   // static per-route instructions — gets cache_control
  prompt: string;          // variable, per-request content — never cached
  maxTokens: number;
  temperature: number;
  model?: string;
}

function buildMessages(params: CompletionParams) {
  if (!params.cachedPrefix) {
    return [{ role: 'user' as const, content: params.prompt }];
  }
  return [{
    role: 'user' as const,
    content: [
      { type: 'text' as const, text: params.cachedPrefix, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: params.prompt },
    ],
  }];
}
```

`system` stays a plain string with **no** `cache_control` of its own — the breakpoint on the later message block still caches everything before it (system included), per the `tools → system → messages` render order in §1.

**`backend/src/routes/pipeline.ts`** — stop concatenating the static template into the variable string; pass them separately:

```typescript
// before (pipeline.ts:185)
const userPrompt = `${ROLE_ANALYSIS_USER}\n\nROLE DESCRIPTION:\n${roleDescription}`;
const rawOutput = await createCompletion({ system: PIPELINE_SYSTEM_PROMPT, prompt: userPrompt, maxTokens: 600, temperature: 0.1 });

// after
const rawOutput = await createCompletion({
  system: PIPELINE_SYSTEM_PROMPT,
  cachedPrefix: ROLE_ANALYSIS_USER,
  prompt: `ROLE DESCRIPTION:\n${roleDescription}`,
  maxTokens: 600, temperature: 0.1,
});
```

Same change at `assess-risk` (`:256`, template `RISK_ASSESSMENT_USER`), `executeAMLRMapping` (`:349`, template `AMLR_MAPPING_USER`), and `generate-plan` (`:474`, template `TRAINING_PLAN_USER`).

**Fix the retry-invalidation bug at the same time** (`:196`, `:260`, `:353`) — the "CRITICAL: Output ONLY..." addendum must move out of `system` (which must stay byte-identical to keep hitting the same cache entry) and into the uncached `prompt` portion instead:

```typescript
// before — mutates system, creates a second, separate cache entry
const retryOutput = await createCompletion({
  system: PIPELINE_SYSTEM_PROMPT + '\n\nCRITICAL: Output ONLY the JSON object. No markdown.',
  prompt: userPrompt, maxTokens: 600, temperature: 0.0,
});

// after — system and cachedPrefix stay byte-identical to the first attempt, so this call
// is a cache read (0.1x) on everything except the small addendum + the unchanged variable data
const retryOutput = await createCompletion({
  system: PIPELINE_SYSTEM_PROMPT,
  cachedPrefix: ROLE_ANALYSIS_USER,
  prompt: `ROLE DESCRIPTION:\n${roleDescription}\n\nCRITICAL: Output ONLY the JSON object. No markdown.`,
  maxTokens: 600, temperature: 0.0,
});
```

This retry path is the one place in the current codebase where a cache hit is **guaranteed** by construction (same route, seconds apart, well inside any TTL) rather than dependent on traffic timing.

### 4.3 — 5-minute vs. 1-hour TTL

The task framing assumes "5 calls in quick succession," but reading `pipeline.ts` end to end shows this isn't quite right: the four `PIPELINE_SYSTEM_PROMPT`-sharing calls hit **four different routes** (`analyze-role`, `assess-risk`, `map-amlr`, `generate-plan`), each on a **different frontend screen** (`RoleImport.tsx`, `RiskAssessment.tsx`, an AMLR-mapping screen, `TrainingPlan.tsx` — confirmed via `grep` across `frontend/src/screens/`), separated by two explicit human-review gates (`PATCH /:id/risk`, `PATCH /:id/amlr`). Because each route's static template differs, **the four calls within one plan's own pipeline run mostly don't share a cache entry with each other** — the reuse that matters is across *separate* pipeline runs hitting the *same* route (different plans, potentially different admins/companies, since `PIPELINE_SYSTEM_PROMPT` and the four templates have zero per-user or per-company interpolation and are identical for every caller).

Given that:
- **Start on the default 5-minute TTL.** It's strictly cheaper unless call gaps on the same route are reliably 5–60 minutes apart, and it requires zero extra code (`cache_control: {type: "ephemeral"}` with no `ttl` field).
- **The guaranteed win (§4.2's retry fix) is always within-5-minutes** regardless of human review pacing, since a validation-failure retry fires seconds after the first attempt on the same request.
- **The traffic-dependent win** (a different admin hitting the same route while the entry is still warm) scales with how many companies are actively running the pipeline concurrently — worth watching in production via `cache_read_input_tokens`, but not something to guess at pre-launch. Move to `ttl: "1h"` only if usage data shows same-route gaps clustering in the 5–60 minute band (e.g., one admin working through Risk Assessment review before moving to AMLR mapping) — remember the 1-hour write costs 2× and needs 2 cache reads to beat plain 5-minute caching, so don't flip this without evidence.
- **Streaming is compatible with caching** — `/generate-plan` uses `streamCompletion`, and nothing in the primary docs restricts `cache_control` to non-streaming requests; the pre-warming-specific restriction (`max_tokens: 0` rejects `stream: true`) does not apply here since Vidda isn't pre-warming, just reading/writing normally on a real request.
- **The transient-failure retry in `anthropic.ts` (429/5xx) is cache-neutral**, as noted in §3 — no change needed there.

### 4.4 — Realistic savings estimate

Using the measured token counts in §3 and Sonnet 4.5's real pricing ($3/MTok base input, $0.30/MTok cache read):

- **Per full plan generation, at steady-state cache hits** (all 4 shared prefixes read from cache instead of paid at full price): 1,157 + 1,066 + ~1,006 + 1,833 ≈ **5,062 prefix tokens** × ($3.00 − $0.30)/1e6 ≈ **$0.0137 saved per plan**.
- **Per retry event** (guaranteed hit, §4.2): e.g. on `assess-risk`, 2 calls at 1,066 shared tokens costs $0.0064 uncached vs. $0.0043 cached (write 1.25× + read 0.1×) — **≈33% cheaper on the retried portion**, a few thousandths of a cent per retry.

Both numbers are small in absolute terms — this pipeline's cost is dominated by **output** tokens (`generate-plan` alone allows `maxTokens: 5000` at $15/MTok output, i.e. up to $0.075 per call, versus the ~1–2¢ of prefix savings above). Caching here is a legitimate, zero-quality-tradeoff "free win" worth doing, but it is not where a cost-reduction effort should focus first if the goal is materially lowering the bill — output-token discipline (tighter `maxTokens`, or the `output_config.effort` lever on newer models) and the missing timeouts/backoff noted in `docs/research/ai-production-readiness.md` §1.1–1.2 are higher-leverage than caching at this prompt's current size.

---

## 5. Caveats that matter here

- **Verify, don't assume.** Given the borderline token math throughout this doc, the single most important action after implementing §4.2 is checking `response.usage.cache_creation_input_tokens` / `cache_read_input_tokens` on at least one call per route in a staging environment — especially `/map-amlr`, which is the one route sitting right at the threshold.
- **Model upgrade would help independently of caching.** `claude-sonnet-4-5` is listed as a "Legacy model (still available)" on the current models overview page; `claude-sonnet-5` shares the same 1,024-token minimum but is cheaper ($2/$10 vs. $3/$15 per MTok) — switching `ANTHROPIC_MODEL` would reduce both cached and uncached costs regardless of the caching work in this document, and is a one-line env-var change (`anthropic.ts:10`) worth doing separately.
- **The `AMLR_MAPPING_USER`-route borderline case has a natural growth path if it doesn't clear the minimum**: the AMLR mapping and training-plan generation steps both build `articleExcerpts` from `searchChunks('AMLR', roleTitle, 8)` (`pipeline.ts:342`, `:456`) — this content is per-role and can't be cached, but if a future version of Vidda pre-defines a small set of standard AMLR excerpt bundles reused across similar roles, that's a second, larger caching opportunity beyond what's in scope here.
- **Caches are workspace-scoped, not company-scoped.** Per the primary docs, cache entries are isolated per Anthropic workspace/API key, not per Vidda tenant — since Vidda uses one shared `ANTHROPIC_API_KEY` (`anthropic.ts:6`) across all companies, cache reuse across *different customers'* pipeline runs is real and intentional, not a leak: the cached content (system prompt + static templates) contains no customer data, only Vidda's own fixed instructions.
- **Quality-scorer call is not a candidate** (§3) — its system prompt (`COHERENCE_PROMPT`, ≈218 tokens) is too small on every current model and has no other stable content to merge with.
