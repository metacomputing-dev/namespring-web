# Authority Reference Cases (Reference A)

This directory holds the Reference A fixtures per
[`spring-info/09_finalization/00_target_baseline.md` §3.1](../../../../../spring-info/09_finalization/00_target_baseline.md)
and the F-A16 deliverable
[`16_korean_authority_cases.md`](../../../../../spring-info/09_finalization/16_korean_authority_cases.md).

## Purpose

Each file under this directory is a JSON record extracted from a published
Korean myeongri reference (Reference A). The `tools/quality_gate.mjs`
D1/D2/D4 dimensions consume these files when present.

Filenames are `<fixture-id>.json` matching an entry in
`test/fixtures/spring_ts_baseline_cases.json`. When the fixture id has no
authority case, the file is simply absent and `quality_gate.mjs` reports
N/A on that fixture's reference-A-driven checks.

## Schema

Each file is a JSON object with the following structure (mirrors F-A16 §2):

```json
{
  "case_id": "A1-saju-001",
  "source": {
    "text": "사주첩경",
    "author": "이석영",
    "volume": 4,
    "page": "TBD",
    "category": "정관격 신왕"
  },
  "expected": {
    "gyeokguk": "정관격",
    "yongshinElement": "WATER",
    "strengthLevel": "신강",
    "tenGodEmphasis": ["정관", "정인"],
    "evaluation": "길명",
    "summary50char": "(≤50자 paraphrase, original quotes prohibited)"
  },
  "narrative": {
    "charsPerClaim": null,
    "evidenceRowsPerClaim": null,
    "counterexampleCountPerCard": null
  },
  "hedge": {
    "shouldHedge": false,
    "reason": null
  },
  "copyrightNote": [
    "birth pillars 는 사실 (저작권 없음)",
    "summary 는 50자 이내 paraphrase",
    "원전 원문 인용 0 줄"
  ]
}
```

## Field guide

- **case_id** — namespaced identifier. `A1-` for 사주첩경, `A2-` for 박재완 *명리요강*, `A3-` for 박재완 *명리실관*.
- **source** — citation. Birth pillars are facts and not subject to copyright; the summary must be ≤50자 paraphrase.
- **expected.gyeokguk** — Korean label matching `gyeokgukEncyclopedia.korean` for cross-reference.
- **expected.yongshinElement** — uppercase code (`WOOD` / `FIRE` / `EARTH` / `METAL` / `WATER`).
- **expected.strengthLevel** — Korean label (`신강` / `신약` / `중화` / `극신강` / `극신약`).
- **narrative.charsPerClaim** / **evidenceRowsPerClaim** / **counterexampleCountPerCard** — captured during F-A16 extraction; D2 dimension consumes these.
- **hedge.shouldHedge** — `true` when the authority text recommends hedging. D4 dimension consumes this label.

## License

Source texts are commercial copyright works. Files in this directory store **only the birth pillars (factual)** and **paraphrased summaries (≤50자)**. Original prose is not reproduced.

Per F-A16 §4: 출처 명기 + paraphrase 정책 준수. fair use limited.

## Status

PR-M-4 (2026-04-30) added a sub-track at `lecture/` containing 11
cases distilled from the 명리심리상담사 교안 (14차시 + 15차시 사례),
mirrored from `saju_master.casebook.LECTURE_CASES`. See
[`lecture/README.md`](./lecture/README.md) for schema and provenance.

The lecture sub-track uses a **different schema** than this
directory's `<fixture-id>.json` form: it is keyed by case_id, holds
pillar-input fixtures, and expects ten-god positions rather than
gyeokguk/yongshinElement. `quality_gate.mjs` does not currently
consume the lecture sub-track — see PR-M-5 (planned) for the
validation runner.

The flat top-level `<fixture-id>.json` files (matching the schema in
the next section) are still pending. Real cases for the 12-fixture
calendar-input track will land as the maintainer secures pillars +
≤50자 paraphrase from a published Reference A text (사주첩경 / 박재완
명리요강 / 박재완 명리실관). Until then `quality_gate.mjs` continues
to report **N/A** on those fixtures' reference-A-driven dimensions,
which remains the truthful state.
