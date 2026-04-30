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

## Capture procedure (Phase L follow-up PR-L-7)

`tools/capture_saju_master_runs.mjs` (TBD) takes the existing fixture
list and invokes saju_master CLI per fixture, writing each output as
`<fixture-id>.json` here. License: saju_master is the local reference
project; outputs are derived data and stored under the same project
license as spring-ts.

## Status

The directory **intentionally ships empty** of oracle files. An earlier
`fix-01.json` placeholder copied the spring-ts snapshot's expected
values back into the gate, which made `quality_gate.mjs` D1/D3 PASS on
a circular comparison. That placeholder has been removed.

`tools/capture_saju_master_runs.mjs` is wired in as a placeholder entry
point but the underlying saju_master CLI is not materialised in this
checkout — invoking it currently exits with code 2 and instructions to
extract `saju_master_project_v9_2.zip` into a sibling directory. Once
the CLI is available, `npm run capture:oracles` populates this
directory in bulk.

Until oracle data lands, `quality_gate.mjs` correctly reports **N/A**
on this fixture's reference-B-driven dimensions, which is the truthful
state.
