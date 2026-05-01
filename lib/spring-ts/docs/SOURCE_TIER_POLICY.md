# Source Tier Policy

This policy controls whether a rule, fixture, reference output, or user-facing
phrase can be used as authority truth in spring-ts validation.

## Tier Definitions

| Tier | Name | Examples | Authority Truth |
| --- | --- | --- | --- |
| `T5_OFFICIAL` | Official or machine-verifiable source | law.go.kr, KASI/public-data APIs, Unicode Unihan | Yes |
| `T4_PRIMARY_TEXT` | Public-domain or otherwise permitted primary text | short quotations from public classical texts | Limited |
| `T3_AUTHORED_INTERPRETATION` | Authored interpretation with date/context | lecture material, named expert article, curated modern myeongri extraction | Review required |
| `T2_UNVERIFIED_ONLINE` | Unnamed blog/community or implementation comparison | community extract, reference implementation output | No standalone truth |
| `T1_HYPOTHESIS` | AI/training-derived or synthetic doctrinal hypothesis | generated jonggyeok scenarios, training-derived authority cases | No |
| `T0_UNSOURCED` | Memory, guess, or missing provenance | any unattributed doctrine claim | No |

Only `T5_OFFICIAL`, `T4_PRIMARY_TEXT`, and explicitly reviewed `T3_AUTHORED_INTERPRETATION`
records may drive pass/fail authority accuracy. `T0_*` and `T1_*` records must
never enter authority denominators. `T2_*` records may be used for comparison,
regression observation, or hypothesis discovery, but not as standalone truth.

## Required Metadata

Every authority-style record must include a `sourceTier` object matching
`test/baseline/schema/sourceTier.schema.json`.

```json
{
  "sourceTier": {
    "tier": "T1_HYPOTHESIS",
    "sourceType": "training_derived",
    "sourceUrl": null,
    "accessedAt": "2026-05-01",
    "quoteShort": null,
    "humanInterpretation": "Synthetic doctrinal fixture retained for regression observation only.",
    "copyrightNote": "No quoted source text; not citation anchored.",
    "authorityTruthEligible": false
  }
}
```

## Gate Behavior

`npm run quality:gate` audits source-tier metadata before reporting overall
status. If a `T0_*` or `T1_*` record is placed where the gate would consume it
as authority truth, the gate fails with a source-tier violation. Low-tier
records can remain in the repository as hypotheses, compatibility references,
or regression observations when `authorityTruthEligible` is `false`.

## Current Source Classes

- `test/fixtures/jonggyeok_cases.json`: `T1_HYPOTHESIS`; training-derived
  doctrinal targets, not citation anchored.
- `test/baseline/authority/training_derived/*.json`: `T1_HYPOTHESIS`; retained
  for pillar consistency and future book-review matching only.
- `test/baseline/oracles/*.json`: `T2_REFERENCE_IMPLEMENTATION`; saju_master
  comparison output, not ground-truth authority.
- `test/baseline/authority/lecture/*.json`: `T3_AUTHORED_INTERPRETATION`;
  lecture-derived cases with paraphrased expected fields.
- `test/baseline/authority/jonheom/*.json`: `T4_PRIMARY_TEXT`; short classical
  quotations and human extraction from source images.

