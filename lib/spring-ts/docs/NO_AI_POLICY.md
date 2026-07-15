# No-AI Compliance Policy

spring-ts rule quality is based on deterministic code, official data, public
primary texts, and human-reviewed interpretation. AI-derived material can be
kept only as a low-tier hypothesis or regression observation. It must never
become authority truth **silently** — the single disclosed, owner-adjudicated
exception is defined below and everything else remains fail-closed.

## Data Policy

AI-derived or model-generated records must satisfy all of these constraints:

- `sourceTier.authorityTruthEligible` is `false`.
- `sourceTier.tier` is below authority rank, normally `T1_HYPOTHESIS`.
- `sourceTier.sourceType` and adjacent provenance fields clearly mark the row
  as AI-derived, training-derived, synthetic, or generated.
- The record is not counted in pass/fail authority denominators.

## Panel-adjudicated exception (policy v2, 2026-07-10)

Adopted by the project owner on 2026-07-10 (see review-mechanism decision in
`RELEASE_APPROVAL_POLICY.md`): a record whose judgements were drafted by a
multi-model AI panel **may** carry `T3_AUTHORED_INTERPRETATION` with
`authorityTruthEligible: true` only when *all* of the following hold, enforced
mechanically by `tools/check_no_ai_policy.mjs`:

- `sourceTier.sourceType` is exactly `ai_panel_adjudicated_interpretation`.
- `sourceTier.aiGenerated` is `true` — concealing AI origin stays a violation;
  disclosure is what unlocks the exception, never silence.
- `sourceTier.panelAdjudication` records `models` (2+ distinct model
  identities), `adversarialVerification: true`, and `dossier` — a repo-relative
  path to the versioned panel dossier that must exist.
- `sourceTier.authorityReview` is an approved owner review (status/reviewedBy/
  reviewedAt), i.e. a named human accepted accountability for the judgement
  after reading the dossier.

**Honesty boundary:** such records are *panel-adjudicated interpretations*,
not external-expert certification. Documents and PR text must not describe
them as independent human expert validation. `data/sources/**` registry rows
remain fully closed to AI-derived sources — the exception applies to
authority-truth fixtures only.

Examples of AI markers include:

- `aiGenerated: true`
- `modelGenerated: true`
- `llmGenerated: true`
- `source.kind: "training_derived"`
- `source.ai_model`
- `sourceTier.sourceType: "training_derived"`

`test/baseline/authority/training_derived/*.json` is the canonical allowed
shape: those fixtures are retained for pillar consistency and future review,
but they remain `T1_HYPOTHESIS` and `authorityTruthEligible: false`.

## Source Registry Policy

`data/sources/*.json` must not register AI, LLM, prompt-generated, or
model-generated sources as source rows. Official APIs, public primary texts,
and reviewed authored interpretations can be registered; AI-generated sources
must remain outside the source registry and cannot carry authority truth.

## Runtime Policy

spring-ts runtime must not depend on LLM or AI SDK packages. Any addition of
packages such as `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`,
`langchain`, `ai`, or similar runtime LLM clients is a review blocker.

Development-time experiments can be documented outside runtime code, but they
must not be imported from `src/**`, shipped as runtime dependencies, or used as
authority-truth data.

## Gate

Run:

```bash
npm run ci:no-ai-policy
```

The CI command runs the policy's negative-test suite and binds the existing
legacy `ai_missing_sourceTier` debt to an exact count and SHA-256 fingerprint.
Adding, removing, renaming, or replacing any acknowledged row fails CI until
the debt fingerprint is deliberately reviewed and updated. To run the raw
zero-debt audit (which remains red until the legacy corpus is migrated), use
`npm run audit:no-ai-policy:strict`.

The gate scans:

- `test/baseline/authority/**/*.json`
- `test/baseline/oracles/**/*.json`
- `test/fixtures/**/*.json`
- `data/**/*.json`
- `data/sources/**/*.json`
- runtime package dependencies in `package.json` and `package-lock.json`
- runtime source imports under `src/**`

Violations fail with exit code `1`; unreadable inputs fail with exit code `2`.
