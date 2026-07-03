# RETIRED: PLAN_PHASE1 ~ PLAN_PHASE40 야간 카피 품질 루프 은퇴 선언

> 2026-07-03, 브랜치 `claude/tiered-article-rewrite`.

이 저장소의 `PLAN_PHASE*.md` 40개 문서가 정의하던 야간 루프(fragment 밀도·커버리지·플로어·래칫
지표 최적화)는 **이 시점부로 은퇴한다.** 해당 루프는 재개하지 않는다.

## 은퇴 사유 (실측)

- 루프의 목표 함수가 "fragment 수·밀도·커버리지"였기 때문에, 지표를 채우는 텍스트가 양산되었다.
  fragment 4,225개 중 1,461개(35%)가 지표명을 딴 `_coverage/` 파일에 있다.
- 생성 품질 방어를 위해 정규식 사후 치환이 4겹(약 12,000줄) 누적되었고, 그 결과
  리포트 1회 생성에 29~35초(76%가 정규식 치환), 프론트 번들 9.0MB가 되었다.
- 동료 리뷰 판정: 문장 조각 조립 방식 자체가 잘못된 방향. 문단 3개 이상이 자연스럽게 이어지는
  완결된 글이 목표 기준이다.

## 이후 방향

- `PLAN_ARTICLE_REWRITE.md`가 후속 계획의 단일 진실이다.
- 콘텐츠 품질 루프를 다시 돌리려면 목표 함수는 반드시 **최종 렌더 글에 대한 게이트**
  (`docs/ARTICLE_STYLE_CONTRACT.md` + `tools/article-quality-gate.ts`)여야 한다.
  fragment/문장 수·밀도·커버리지류 지표를 보상으로 삼는 루프는 금지.
- `data/narrative/**`의 fragment 번들과 `_coverage/`는 동결 상태이며 Phase 3a에서 제거된다
  (`_glossary/`는 유지).
