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

PR-L-5 (this PR) seeds the directory with one **placeholder** case
(`fix-01-placeholder.json`) so the schema is testable by `quality_gate.mjs`
even before real cases ship. Real cases land as the maintainer secures
copies of the source texts (별도 사용자 작업).
