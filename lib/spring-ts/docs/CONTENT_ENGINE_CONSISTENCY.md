# 콘텐츠 ↔ 엔진 일관성 감사 (Content ↔ Engine Consistency)

> 2026-07-04 감사. 질문: **아티클 코퍼스의 전문가 글(태그 포함)이 spring-ts 하위 엔진이
> 산출한 그 사람의 사주 분석과 논리적으로 일맥상통하는가?**
> 결론: **구조적 수준에서 일치함**(태그 도메인·밴드 방향·슬롯·수치근거). 개인별 격국/신살까지
> 매칭하지는 않음(설계상 의도 — [PLAN_ARTICLE_REWRITE.md](../PLAN_ARTICLE_REWRITE.md) §1.2).

## 1. 무엇이 사람별로 계산되는가 (엔진 파생)

`build-tiered-matrix.ts` → `feature-selector.ts`가 `SajuSummary`(실제 엔진 분석)에서 추출:

| 요소 | 출처 | 콘텐츠에 반영되는 경로 |
|---|---|---|
| 일간/용신/희신/기신 오행 | `saju.dayMaster`, `saju.yongshin` | 슬롯 `{{dayMasterName}}`·`{{yongshinName}}`, `gradeCell` |
| 강약·격국·신살·오행분포 | `saju.strength/gyeokguk/shinsalHits/elementDistribution` | `numericalEvidence`(오행 개수), **밴드 계산 입력** |
| 기간 중심 오행(fortuneElement) | `period-meta-builder`, 대운 pillar | `gradeCell`/`gradeCategoryCell` |
| 나이·연령대 | 생년+기준일 | audience(adult/teen/child/stage-*), numericalEvidence |
| 이름 사격 | `namingReport.fourFrame` | `namingEvidence` |

**밴드(별점)는 진짜 사주 분석 파생이다.** `gradeCell(fortuneElement, yongshin, heeshin, gishin)`이
기간 오행과 그 사람의 용신·희신·기신 관계로 등급을 내고, `gradeCategoryCell`이 `categoryElements()`의
카테고리→십성 오행 매핑을 60% 가중해 블렌딩한다. 즉 "wealth low"는 이 사람의 재물 오행이 용신과
불리하게 맞물린다는 실제 계산 결과다.

## 2. 무엇이 저작 상수인가

expert/body prose와 그 태그(`#{jeongjae}`, `#{gishin}` …)는 `(category, period, audience, band)` +
시드로만 선택되는 저작 콘텐츠다. 개인의 격국/신살/강약 조합에 맞춰 문장이 바뀌지는 않는다.

## 3. 일관성 검증 (실측)

### 3.1 태그가 카테고리 십성 도메인과 일치하는가 — ✅
전 코퍼스 expert 태그를 글로서리로 분류해 `categoryElements()` 기대 도메인과 대조:

| 카테고리 | 지배 십성(실측) | 궁/신살 | 판정 |
|---|---|---|---|
| wealth | 재성 56, 비겁 13 | 용신 | ✅ |
| health | 인성 26, 식상 20 | 천의·조후용신 | ✅ |
| academic | 인성 37, 식상 21 | 학당·문창귀인 | ✅ |
| romance | 관성 15 | 배우자궁·도화·홍염·음양 | ✅ |
| family | 인성 23 | 부모궁·형제궁·조상궁·자식궁 | ✅ |
| career | 관성 23, 식상 33 | 건록격·용신 | ✅ |
| study_document | 인성 54, 식상 10 | 문창귀인·학당 | ✅ |
| expression_children | 식상 49 | 문창귀인·도화·자식궁 | ✅ |
| health_stress | 인성 30, 관성 29 | 천의·기신 | ✅ |
| movement | 식상 15 | 역마 19·천이궁 15·지살 12 | ✅ |

- **미등록 태그 0** (게이트가 강제하지만 재확인).
- "off-domain"으로 뜬 소수(career 식상=실행/성과, movement 편재=활동성 재물, family 재성=부친)는
  기대맵이 못 담은 **정통 사주 의미**이지 오류가 아님.

### 3.2 개인과 모순되는 절대 주장이 없는가 — ✅
선택이 강약/개수를 안 쓰므로 "일간이 강하니/용신이 넉넉하니" 같은 **고정 사실 단정**은 위험하다.
전 expert prose 스캔 결과 **0건**. 저작이 기간-상대적·조건절·슬롯 기반("`#{yongshin}` 오행인
`{{yongshinName:이가}}` 채워질 때", "`#{yongshin}` 보강은…")으로만 서술해 개인 feature와 절대 충돌하지 않음.

## 4. 정직한 경계

전문가 글이 지목하는 **구체적 십성/신살 메커니즘**은 밴드-전형(low=불리, high=유리) 수준이지, 그 사람의
정확한 격국·신살 조합에서 연역된 것이 아니다. 이는 조합 폭발과 워드샐러드를 피하려 11차원 게이팅을
폐기한 설계 결정의 결과다([PLAN_ARTICLE_REWRITE.md](../PLAN_ARTICLE_REWRITE.md) §1.2).
개인화는 **밴드(실측)+슬롯(실측)+수치근거(실측)+오디언스(실측)**로 이루어지고, 서사 메커니즘은
카테고리-도메인 정확·밴드-방향 근거를 갖되 일반화되어 있다.

## 5. 재현 방법
- 태그 도메인 감사: 글로서리(`data/narrative/_glossary/*.json`) id→category 로드 후 아티클 expert 태그를
  카테고리별로 tally, `categoryElements()`(build-tiered-matrix.ts) 기대 십성과 대조.
- 절대 주장 스캔: expert prose에서 `일간이 (강|약)`, `용신이 (넉넉|부족)`, `신강|신약` 등 정규식 매칭.
