# Oracle Reference Cases (Reference B — saju_master CLI)

This directory holds the Reference B fixtures per
[`spring-info/09_finalization/00_target_baseline.md` §3.2](../../../../../spring-info/09_finalization/00_target_baseline.md)
and the F-A12 deliverable
[`12_korean_top_baseline.md`](../../../../../spring-info/09_finalization/12_korean_top_baseline.md).

## Purpose

Each file under this directory captures the JSON output of the
saju_master_project_v9_2 CLI for one fixture. The
`tools/quality_gate.mjs` D1/D3/D4 dimensions consume these files when
present, and the `tools/capture_saju_master_runs.mjs` wrapper (Phase L
follow-up) populates them in bulk.

These JSON files are `T2_REFERENCE_IMPLEMENTATION` records. They are retained
for compatibility and divergence tracking, but `authorityTruthEligible` is
`false`; they must not be treated as pass/fail authority truth.

Filenames are `<fixture-id>.json` matching an entry in
`test/fixtures/spring_ts_baseline_cases.json`. Absent file =
quality_gate's reference-B-driven checks report N/A on that fixture.

## Schema

Each file is a JSON object capturing the saju_master output that
`quality_gate.mjs` evaluates against:

```json
{
  "case_id": "B-fix-01",
  "source": {
    "tool": "saju_master_project_v9_2",
    "version": "9.2",
    "command": "python -m saju_master ... --json",
    "capturedAt": "YYYY-MM-DDThh:mm:ssZ"
  },
  "expected": {
    "gyeokgukType": "식신격",
    "gyeokgukCategory": "일반",
    "yongshinElement": "METAL",
    "yongshinHeeshin": "WATER",
    "strengthLevel": "신약",
    "tenGodEnumeration": ["식신", "정관", "..."],
    "shinsalEnumeration": ["...", "..."],
    "scores": {
      "totalScore": null,
      "hangul": null,
      "hanja": null,
      "fourFrame": null
    }
  },
  "cards": {
    "surfacedCardTypes": [
      "gyeokguk", "yongshin", "sipsin", "shinsal"
    ]
  },
  "axisStrength": {
    "yongshin": "practical",
    "gyeokguk": "definite",
    "strength": "definite"
  },
  "hedge": {
    "shouldHedge": false
  }
}
```

## Field guide

- **expected.gyeokgukType** / **yongshinElement** / **strengthLevel** —
  matched against `quality_gate.mjs` D1 categorical checks.
- **expected.scores** — when populated, matched against D1 numerical
  checks (±2.0 tolerance on totalScore, ±1.0 on individual scores).
- **cards.surfacedCardTypes** — D3 dimension verifies `springTsCardTypes ⊇ saju_masterCardTypes`.
- **axisStrength** — D4 dimension consumes saju_master's 4-tier
  judgment-strength labels for hedge precision/recall.

## Capture procedure

`tools/capture_saju_master_runs.mjs` (wired in PR-M-1) walks the fixture
list and invokes the saju_master CLI per fixture, writing each output
as `<fixture-id>.json` here. Required environment:

- `SAJU_MASTER_DIR` — path to the extracted `saju_master_project_v9_2`
  tree. Defaults to `<repo-root>/../saju_master_project_v9_2` when not
  set.
- `SAJU_MASTER_PYTHON` — Python interpreter with `pyswisseph` and
  `korean-lunar-calendar` installed. The script auto-detects common
  conda env paths (e.g. `C:\miniconda3\envs\py311\python.exe`) when the
  variable is unset.

Run via:

```bash
npm run capture:oracles                                # all 12 fixtures
node tools/capture_saju_master_runs.mjs --fixtures fix-01,fix-08
node tools/capture_saju_master_runs.mjs --dry-run      # preview only
```

License: saju_master is the local reference project; the captured
JSONs are derived data stored under the same project license as
spring-ts.

## Status

The directory ships with a full 12-fixture capture (PR-M-1, dated
2026-04-30) using saju_master_project_v9_2. The captured JSON is the
saju_master implementation's view of each fixture's
`gyeokgukType / yongshinElement / strengthLevel` and is **not a
ground-truth oracle**; it is a reference for cross-implementation
consistency.

Several fixtures (e.g. fix-02, fix-06, fix-10) show categorical
disagreement between spring-ts and saju_master. Both implementations
descend from the same broad 자평 tradition, so the disagreement
generally reflects either (a) different rule for picking the primary
gyeokguk when multiple ten-gods transparent on the month branch, or
(b) different boundary policy for 중화 vs 신약/신강. `quality_gate.mjs`
D1 reports these as FAIL, which is informative — but FAIL here means
"two implementations disagree", not "spring-ts is wrong". See the PR
description for the per-fixture diff.

Authoritative resolution requires a Reference A authority case (see
sibling `authority/` directory).
