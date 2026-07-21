# Source Tier Policy

This policy controls whether a rule, fixture, reference output, or user-facing
phrase can be used as authority truth in spring-ts validation.

## Tier Definitions

| Tier | Name | Examples | Authority Truth |
| --- | --- | --- | --- |
| `T5_OFFICIAL` | Official or machine-verifiable source | law.go.kr, KASI/public-data APIs, Unicode Unihan | Only for its declared official-data scope |
| `T4_PRIMARY_TEXT` | Public-domain or otherwise permitted primary text | short quotations from public classical texts | Limited |
| `T3_AUTHORED_INTERPRETATION` | Authored interpretation with date/context | lecture material, named expert article, curated modern myeongri extraction | Review required |
| `T2_UNVERIFIED_ONLINE` | Unnamed blog/community or implementation comparison | community extract, reference implementation output | No standalone truth |
| `T1_HYPOTHESIS` | AI/training-derived or synthetic doctrinal hypothesis | generated jonggyeok scenarios, training-derived authority cases | No |
| `T0_UNSOURCED` | Memory, guess, or missing provenance | any unattributed doctrine claim | No |

Only records whose exact tier/sourceType pair and requested scope are in the
reviewed allowlist may drive a pass/fail denominator. T5 calendar, legal,
Unicode, court-statistics, and phonetic records are authoritative only for
their respective data scopes; they cannot become saju doctrine or naming-score
truth. Unknown classes and cross-scope payloads fail closed. `T0_*`, `T1_*`,
and `T2_*` records never enter authority denominators.

The release denominators are deliberately separated:

- `saju_doctrine`: normalized gyeokguk, yongshin element, and strength claims;
- `naming_score_calibration`: total and component naming scores;
- `narrative_semantic_contract`: reviewed narrative inclusion/exclusion claims;
- `product_surface_contract`: expected surfaced product cards;
- `safety_copy_policy`: hedging and uncertainty-copy requirements.

No alias grants all five scopes. D1 is complete only when all seven required
fields are measured: `gyeokguk`, `yongshinElement`, and `strengthLevel` for
`saju_doctrine`, plus `totalScore`, `hangul`, `hanja`, and `fourFrame` for
`naming_score_calibration`. Any partial component remains `N/A`, and D5
structural stability cannot convert it to accuracy.

Generic T3 owner review alone is not authority evidence. AI-panel T3 records
must satisfy the evidence-bound panel contract below; any future human-expert
T3 class needs its own explicit source contract and review evidence before it
is added to the allowlist.

### Interim review mechanism (not release certification)

This project currently has no external myeongri expert. The owner adopted a
two-layer review mechanism for every `authorityReview` and approval control:
**multi-model AI cross-verification** (independent adversarial panel, dossier
versioned in-repo) as the evidence layer, and the **project owner's signature**
(`reviewedBy`) as the accountability layer. Records whose *judgements
originate from* the AI panel additionally use
`sourceType: "ai_panel_adjudicated_interpretation"` with `aiGenerated: true`
and a `panelAdjudication` block — see `NO_AI_POLICY.md` "Panel-adjudicated
exception" for the mechanical requirements. This mechanism is disclosed
honestly wherever it is used: it is **not** external human expert
certification, and user-facing claims must not present it as such. It may
support WIP evidence development, but it cannot satisfy the external myeongri
expert signoff required to remove Draft status or merge an engine release.

Panel promotion is bound to the exact record. `recordId` and the canonical
`contentDigest` must match an approved row in the dossier's
`panel-manifest.json`; a directory path or owner signature by itself cannot
promote a record. The manifest shape is defined by
`test/baseline/schema/panelAdjudicationManifest.schema.json`.
These digests prove repository consistency only. Model identifiers and
`reviewedBy` remain self-attested metadata; they do not authenticate provider
origin, reviewer identity, or domain expertise.

The current AI-panel exception may declare only `saju_doctrine`. Its
declared scope must exactly match the record payload and the same scope must be
repeated in the manifest and in each model evidence document. Panel output
cannot promote naming-score, product-surface, narrative-regex, or safety-copy
truth.

T4 `classical_primary_text` records are narrower still: only
`expected.gyeokguk`, `expected.strengthLevel`, and
`expected.yongshinElement` are permitted, and each value must satisfy its
normalized scalar contract. Every expected field requires one
`evidenceBindings` row whose quote fragment occurs in the case-bound short
quotation. `sourceUrl` is locator metadata only and never substitutes for
evidence. Promotion requires repository-relative page evidence and a transcript
whose realpaths remain inside the repository, contain no `.tmp`/`tmp` segment,
are tracked by Git, and match their SHA-256 fields; the transcript must contain
the exact case quotation. Scores, cards, hedge policy, and narrative regex
claims are rejected from this source class. Mechanical eligibility still does
not replace external expert release signoff.

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

The audit rejects any authority-eligible record outside the reviewed
tier/sourceType allowlist. Panel-authored T3 records additionally require the
exact sourceType, complete disclosure, approved owner review, canonical record
digest, and a matching approved dossier manifest row. The same central policy
is used by metadata audit, the No-AI release gate, and denominator selection.

### 2026-07-10 demotion of 25 legacy T3 records

The 25 legacy T3 records (2 `chumyeongga`, 9 `figures`, 14 `lecture`) that
claimed `authorityTruthEligible: true` without an approved review were demoted
in place: `authorityTruthEligible` is now `false` and each record carries
`reviewStatus: "pending_independent_review"`, `demotedAt`, and a
`demotionNote`. Nothing else in the records changed; expected judgements and
provenance are preserved verbatim. This makes the tier metadata truthful — the
records were already excluded from every accuracy denominator by the
eligibility rule, so no gate arithmetic changed.

**Re-promotion procedure (per record):** adding an owner signature is not
sufficient. These legacy sourceTypes are outside the authority allowlist. A
future promotion needs a separately reviewed source-class contract, immutable
evidence, explicit denominator scope, and independent domain review. Until
that policy change lands, the records remain diagnostic even if a panel
dossier exists.

### 2026-07-10 demotion of six Jonheom interpretations

The six `test/baseline/authority/jonheom/*.json` records point to temporary
`.tmp/pdf-pages/...` images that are not versioned repository evidence. Their
short quotations and interpretations are preserved, but
`authorityTruthEligible` is now `false`. Re-promotion requires a committed
page artifact and quote-containing transcript with matching SHA-256 digests,
field-level quote bindings, approved review metadata, and independent domain
review. A public Wikisource URL by itself is never sufficient.

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
- `test/baseline/authority/jonheom/*.json`: `T4_PRIMARY_TEXT`, currently
  `authorityTruthEligible: false`; short classical quotations and human
  interpretation are retained for regression observation while versioned page
  evidence and independent review are missing.
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
