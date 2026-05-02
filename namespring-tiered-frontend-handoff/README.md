# NameSpring Tiered Report Frontend Handoff

이 폴더는 `spring-ts`의 `FortuneReport.tieredMatrix`를 NameSpring 통합 보고서에 붙이기 위한 프론트엔드 작업 지침이다.

현재 결론은 명확하다.

- `spring-ts` 쪽 새 구조는 구현되어 있다.
- NameSpring은 아직 `precisionConfig.surfaceTieredMatrix: true`를 요청하지 않는다.
- 그래서 현재 서비스 화면은 기존 `overviewSummary`, `dailyFortune`, `categoryFortunes` 기반 카드만 렌더링한다.
- 실제 서비스 UX는 "간단한 표현 먼저, 사용자가 누르면 일반 상세 또는 전문가 근거" 흐름으로 가야 한다.

## 문서 순서

1. [현재 상태와 출력 계약](./01-current-state-and-contract.md)
2. [프론트엔드 UX 설계](./02-frontend-ux-plan.md)
3. [구현 체크리스트](./03-implementation-checklist.md)
4. [확장성과 텍스트 운영](./04-expansion-and-content-ops.md)
5. [1986-04-19 최성수 샘플 출력](./05-sample-output-choi-seongsoo.md)

## 핵심 개발 방향

NameSpring 통합 보고서 첫 화면에서는 전문가 용어를 노출하지 않는다.

사용자는 먼저 `brief`만 본다. 예를 들어 "올해 연애운은 사람과의 결이 깊어지는 흐름이에요." 같은 짧고 이해 쉬운 문장이다. 사용자가 연애운 카드를 펼치면 `standard`가 먼저 보인다. 여기에도 어려운 용어와 해시태그를 노출하지 않는다. 더 깊게 보고 싶은 경우에만 `일반 상세` 또는 `전문가 근거` 버튼을 눌러 상세 내용을 본다.

전문가 용어, 해시태그, 고전적 근거, 수치 근거는 `전문가 근거` 버튼 이후에만 보인다.

## 기준 파일

- NameSpring 호출부: `namespring/src/App.jsx`
- 통합 보고서 페이지: `namespring/src/CombinedReportPage.jsx`
- 현재 통합 보고서 렌더러: `namespring/src/CombiedNamingReport.jsx`
- 공통 접기 UI: `namespring/src/report-modules-ui.jsx`
- 테마 클래스: `namespring/src/theme/report-ui-theme.js`
- `spring-ts` 타입 계약: `lib/spring-ts/src/report/types.ts`
- matrix 생성기: `lib/spring-ts/src/report/tiered/build-tiered-matrix.ts`
- 선택 feature vector: `lib/spring-ts/src/report/tiered/feature-selector.ts`
- 텍스트 데이터: `lib/spring-ts/data/narrative/**`

## 다음 PR의 목표

1. NameSpring이 opt-in 요청을 보내게 한다.
2. 기존 통합 보고서 fallback은 유지한다.
3. `tieredMatrix`가 있을 때 새 period/category/depth UI를 렌더링한다.
4. 전문가 용어는 기본 화면에서 숨긴다.
5. PDF/공유 시 펼침 상태가 깨지지 않게 기존 `useReportActions` 흐름에 맞춘다.
