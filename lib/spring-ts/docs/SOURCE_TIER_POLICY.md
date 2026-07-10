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
Newly promoted T3 records must record an `authorityReview` block containing
`status: "approved"`, a non-empty `reviewedBy`, and an ISO `reviewedAt` date.
Legacy T3 records without this block require review migration; a source URL by
itself is not review evidence.

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

The audit also rejects `T3_AUTHORED_INTERPRETATION` with
`authorityTruthEligible: true` unless `authorityReview` is approved and
complete. The rule is enforced both when auditing metadata and when selecting
records for an accuracy denominator.

### 2026-07-10 demotion of 25 legacy T3 records

The 25 legacy T3 records (2 `chumyeongga`, 9 `figures`, 14 `lecture`) that
claimed `authorityTruthEligible: true` without an approved review were demoted
in place: `authorityTruthEligible` is now `false` and each record carries
`reviewStatus: "pending_independent_review"`, `demotedAt`, and a
`demotionNote`. Nothing else in the records changed; expected judgements and
provenance are preserved verbatim. This makes the tier metadata truthful — the
records were already excluded from every accuracy denominator by the
eligibility rule, so no gate arithmetic changed.

**Re-promotion procedure (per record):** an independent expert reviews the
expected judgement against the cited source, then adds
`sourceTier.authorityReview: { "status": "approved", "reviewedBy": "<name>",
"reviewedAt": "YYYY-MM-DD" }`, restores `authorityTruthEligible: true`, and
removes `reviewStatus`/`demotedAt`/`demotionNote`. D1 accuracy denominators
begin consuming the record automatically once it validates.

Exact default-output change approval is a separate control documented in
`RELEASE_APPROVAL_POLICY.md`; source eligibility does not automatically approve
a branch snapshot delta.

`npm run ci:no-ai-policy` adds the Phase 9.3 recursive guard for AI-derived
records and runtime LLM dependencies. See `NO_AI_POLICY.md` for policy markers
and representative runtime dependency classes.

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
- `data/sources/kasi-solar-terms.sources.json`: `T5_OFFICIAL` for the KASI
  public-data API registry and `authorityTruthEligible: false` for the
  KASI-hosted calendarData minute table until it is reconciled with the
  official monthly almanac publication.
- `data/sources/kasi-lunar-solar.sources.json`: `T5_OFFICIAL` for the KASI
  public-data lunisolar API registry and KASI monthly lunisolar table direct
  date-conversion facts; internal fixture-selection and product-limit policy
  rows remain non-eligible `T3_AUTHORED_INTERPRETATION`.
- `data/sources/classical-myeongri.sources.json`: `T4_PRIMARY_TEXT` registry
  for public classical myeongri texts. The registry stores bibliographic
  metadata and source URLs only; later rule fixtures must keep classical
  verbatim quote fields at or below 80 Unicode code points and must not bulk
  copy source text.

## Non-Authority Feedback Aggregates

`metrics/feedback-aggregate.json` is product feedback telemetry, not a source
record. It must stay source-free, aggregate-only, and marked
`authorityUsage: "not_authority_truth"`. It must not contain `sourceTier`
objects, quotes, source URLs, raw feedback rows, names, birth data, session IDs,
or free-text comments, and it must never enter authority-truth denominators.
