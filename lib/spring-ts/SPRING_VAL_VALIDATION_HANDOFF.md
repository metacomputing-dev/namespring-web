# spring-val validation handoff

`spring-ts` 출력 검증에 필요한 핵심 자료는 별도 추출되어 있습니다.

먼저 읽을 파일:

- `C:\Projects\metaintelligence\spring-val\00_essentials\SPRING_TS_OUTPUT_CHECK_CORE.md`
- `C:\Projects\metaintelligence\spring-val\00_essentials\spring_ts_output_check_core.v1.json`
- `C:\Projects\metaintelligence\spring-val\00_essentials\CLAUDE_HANDOFF.md`

원본 자료실 전체:

- `C:\Projects\metaintelligence\spring-val`

중요 규칙:

- 현재 `spring-ts` 출력은 actual입니다. oracle로 쓰지 마세요.
- `sajuEnabled=false` 출력은 D1-D5 검증에서 제외하고 blocker diagnostic으로만 보관하세요.
- reference 우선순위는 한국 권위 자료 → saju_master oracle → 공식 법령/천문/Unicode → 온라인 수동 reference입니다.
- 저작권 자료 원문은 fixture에 저장하지 말고 50자 이내 paraphrase와 metadata만 저장하세요.

필수 reference:

- `C:\Projects\metaintelligence\spring-val\references\spring-ts-existing\spring_ts_baseline_cases.json`
- `C:\Projects\metaintelligence\spring-val\references\spring-ts-existing\oracles\`
- `C:\Projects\metaintelligence\spring-val\references\spring-ts-existing\authority\`

새 검증 case는 먼저 `spring-val/cases/<case-id>/`에 정리한 뒤, 충분히 정제된 것만 `spring-ts/test`로 옮기세요.
