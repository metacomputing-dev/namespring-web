# Lecture Reference Cases (Reference A — sub-track)

11 case files distilled from the 명리심리상담사 교안 (14차시 + 15차시 사례). These are PR-M-4 imports of the `LECTURE_CASES` constant in `saju_master_project_v9_2/saju_master/casebook.py`, paraphrased to ≤ 50자 per case.

## Provenance

The casebook is bundled with the saju_master Python project (`saju_master.casebook.LECTURE_CASES`). saju_master uses these cases as regression targets — verifying that its intermediate judgments match a coherent teaching source. spring-ts adopts the same set as Reference A authority cases for the same purpose.

## Schema

Each `<case_id>.json` is a JSON object:

```json
{
  "case_id": "A1-p122_1972_female_experience_learning",
  "source": {
    "tradition": "lecture",
    "text": "명리심리상담사 교안",
    "page": 122,
    "author": "(uploaded)",
    "volume": null,
    "category": "14차시 사례"
  },
  "subject": {
    "birth_year": 1972,
    "sex": "female",
    "profession": "체험학습 프로그램"
  },
  "pillars": {
    "year_pillar": "壬子",
    "month_pillar": "辛亥",
    "day_pillar": "己巳",
    "hour_pillar": "丙寅"
  },
  "expected": {
    "month_ten_god": "정재",
    "decision_ten_god": "정인",
    "activity_keywords": ["식신", "정재", "丙辛合"]
  },
  "source_note": "교안 14차시 실례: 본성 월지·용신 正財, 일지 正印, 丁未대운 戊戌년 파산 설명."
}
```

## Differences vs. parent authority/ schema

This lecture sub-track **does not match** the gyeokguk/yongshinElement/strengthLevel schema used by the parent `authority/` directory. The lecture cases were captured by saju_master under a different validation philosophy:

- **pillar-input only** — the casebook gives the chart directly, not enough civil time data to re-run calendar conversion. quality_gate cannot match these against the calendar-input snapshot fixtures.
- **ten-god focused** — the expected fields are about which ten gods dominate which positions, not which 격국 the chart resolves to.
- **activity_keywords** — these are the 4-character classical idioms (e.g., 食神生財, 傷官見官, 殺印相生) the lecture text uses to describe the chart's structure. spring-ts does not currently have a categorical surface that maps to these.

## Status: data-only

PR-M-4 lands the data files. No tooling consumes them yet. PR-M-5 (planned) will:

1. Add a `tools/validate_lecture_cases.mjs` runner that takes the pillars, calls `saju-ts` directly via the pillar-input path, and compares the resulting month-position ten-god + decision-position ten-god to the expected values.
2. Report per-case PASS/FAIL.
3. Surface results in `quality_gate.mjs` as a separate `D6_LECTURE` dimension (or as part of D2 narrative-evidence — TBD).

The runner needs spring-ts (or saju-ts) to support pillar-input directly. saju-ts's analyzer already does this (`calculate_chart_from_pillars` in saju_master is the reference); spring-ts's adapter currently only takes calendar input.

## License

The pillars are factual data and are not subject to copyright. The `expected` fields and `source_note` are ≤ 50자 paraphrased summaries; no verbatim prose from the lecture transcript is reproduced.

Per `09_finalization/F-A16` policy: 출처 명기 + paraphrase 정책 준수, fair use limited.
