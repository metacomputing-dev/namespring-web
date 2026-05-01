# No-AI Compliance Policy

spring-ts rule quality is based on deterministic code, official data, public
primary texts, and human-reviewed interpretation. AI-derived material can be
kept only as a low-tier hypothesis or regression observation. It must never
become authority truth.

## Data Policy

AI-derived or model-generated records must satisfy all of these constraints:

- `sourceTier.authorityTruthEligible` is `false`.
- `sourceTier.tier` is below authority rank, normally `T1_HYPOTHESIS`.
- `sourceTier.sourceType` and adjacent provenance fields clearly mark the row
  as AI-derived, training-derived, synthetic, or generated.
- The record is not counted in pass/fail authority denominators.

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

The gate scans:

- `test/baseline/authority/**/*.json`
- `test/baseline/oracles/**/*.json`
- `test/fixtures/**/*.json`
- `data/**/*.json`
- `data/sources/**/*.json`
- runtime package dependencies in `package.json` and `package-lock.json`
- runtime source imports under `src/**`

Violations fail with exit code `1`; unreadable inputs fail with exit code `2`.
