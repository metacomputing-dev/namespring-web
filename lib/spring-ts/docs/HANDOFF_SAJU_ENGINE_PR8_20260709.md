# HANDOFF - 사주 엔진 감사 PR-8 및 콘텐츠 축 진행 현황 (2026-07-09)

> 새 Codex/Claude 세션이 이 문서만 읽고도 이어받을 수 있도록 남기는 현재 상태 문서.
> 브랜치: `feature/saju-engine-integrity-audit`
> 작업 범위: `lib/saju-ts`, `lib/spring-ts` 백엔드/엔진/테스트/데이터. 프론트엔드는 건드리지 않았다.

## 1. 현재 결론

이번 세션 기준으로 다음은 완료되어 커밋까지 끝났다.

1. 과제 3: 인사이트 해석 콘텐츠 충전
2. 과제 1: 종격 권위 코퍼스 20건 이상
3. 과제 2: 만세력 오라클 코퍼스
4. PR-8 1차: 운 통합 판정용 메타데이터를 엔진 표면에 노출
5. PR-8 2차: 노출된 운 메타데이터를 백엔드 리포트 카드 증거/하이라이트에서 소비

현재 작업 트리는 커밋된 변경 외에는 `.claude/`, `lib/spring-ts/tmp/`만 untracked로 남아 있다. 이 둘은 사용자/임시 산출물로 보존해야 하며, 새 세션에서 임의 삭제하거나 `git add -A`로 섞으면 안 된다.

## 2. 최근 커밋

| 커밋 | 제목 | 의미 |
|---|---|---|
| `b2b9cc3f8` | `report: consume transit luck metadata (10/0, 21/0, 1/0, 15/0, 208/0, 1378/0, 13/0)` | PR-8 메타데이터를 운세 리포트 카드의 evidence/highlights에서 실제 소비 |
| `a4f6dfb78` | `engine: surface transit luck metadata (1/0, 21/0, 15/0, 202/0, 1378/0)` | 대운/세운/월운에 십신, 12운성, 운 신살 메타데이터 표면화 |
| `e8c2da315` | `content: add manseryeok oracle corpus (453/453, 8/0)` | 만세력 오라클 fixture, 수집 스크립트, 통합 테스트 추가 |
| `cf06ad44a` | `content: add jonggyeok authority corpus (20 cases, 148/0)` | 종격 권위 코퍼스 20건과 스캐폴드 검증 확장 |
| `8a9f7499e` | `content: add insight interpretations (54/0, 1378/0, 15/0, 202/0)` | 신규 표면 fact에 붙는 해석 콘텐츠와 레지스트리 테스트 추가 |

## 3. 완료 상세

### 3.1 과제 1 - 종격 권위 코퍼스

- 파일: `lib/spring-ts/test/fixtures/jonggyeok_authority_cases.json`
- 테스트: `lib/spring-ts/test/integration/jonggyeok-authority-scaffold.test.ts`
- 내용: 종격 서브타입 분포를 의식해 20건을 채웠다.
- 모든 신규 케이스는 `sourceTier` 블록을 가진다.
- 확신 없는 케이스는 넣지 않는 원칙으로 갔다.

### 3.2 과제 2 - 만세력 오라클

- 파일:
  - `lib/spring-ts/scripts/fetch-manseryeok-oracle.ts`
  - `lib/spring-ts/test/fixtures/manseryeok_oracle_cases.json`
  - `lib/spring-ts/test/integration/manseryeok-oracle.test.ts`
- 결과: 453건 fixture가 테스트에서 453/453 통과.
- 이 축은 데이터 파일 추가와 소비 테스트만 했고, 엔진 판정 로직은 바꾸지 않았다.

### 3.3 과제 3 - 인사이트 해석

- 파일:
  - `lib/spring-ts/data/articles/insights/gyeokguk-seongpae.insights.json`
  - `lib/spring-ts/data/articles/insights/relations.insights.json`
  - `lib/spring-ts/data/articles/insights/shinsal.insights.json`
  - `lib/spring-ts/data/articles/insights/stem-hap-state.insights.json`
  - `lib/spring-ts/src/report/cards/insight-facts-card.ts`
  - `lib/spring-ts/src/report/tiered/insight-registry.ts`
  - `lib/spring-ts/test/integration/insight-registry-content.test.ts`
- 결과: 신규 표면 fact에 해석이 붙고, 레지스트리/shape 검증을 통과한다.
- provenance 원칙상 AI 저작 콘텐츠를 권위 인용 콘텐츠로 둔갑시키지 않았다.

### 3.4 PR-8 1차 - 엔진 표면화

주요 변경:

- `lib/saju-ts/src/rules/facts.ts`
  - `twelveSalStartOf`를 공개 export.
- `lib/saju-ts/src/compat/springLegacy.ts`
  - 대운, 세운, 월운 행에 `tenGod`, `lifeStage`, `lifeStageKo`, `transitShinsal`을 병기.
  - `wolunPillars`를 legacy output에 추가.
  - 세운/월운 행에 `startUtcMs`, `endUtcMs`, `approxStartAgeYears`, `approxEndAgeYears`를 병기.
- `lib/spring-ts/src/types.ts`
  - `wolunMonthCount`, `TransitShinsalSummary`, `LuckPillarAnnotationSummary`, `WolunPillarSummary`, `wolunPillars` 타입 추가.
- `lib/spring-ts/src/saju-adapter.ts`
  - springLegacy가 방출한 운 메타데이터를 typed extractor로 끌어올림.
- `lib/saju-ts/src/compat/transitShinsal.test.ts`
  - 12 anchor x 12 target 조합으로 삼재, 상문, 조객 배속을 고정.
- `lib/spring-ts/test/integration/adapter-daewoon.test.ts`
  - 대운/세운/월운 annotation과 context lifting 검증.

중요한 설계 경계:

- 명식 원국 신강약, 격국, 별점, `shinsalHits` 원천 스트림은 건드리지 않았다.
- 운 신살은 transit annotation으로만 붙였다.
- 프론트엔드는 건드리지 않았다.

### 3.5 PR-8 2차 - 리포트 소비

주요 변경:

- `lib/spring-ts/src/report/common/transit-luck-metadata.ts`
  - 십신, 12운성, 12신살, 삼재 phase를 사람이 읽는 라벨과 evidence feature로 바꾸는 공용 helper 추가.
- `lib/spring-ts/src/report/cards/period-fortune-card.ts`
  - yearly는 `saeunPillars` interval match를 먼저 사용한다.
  - monthly는 `wolunPillars` interval match를 먼저 사용한다.
  - 기존 공식 fallback은 유지.
  - PR-8 annotation을 `evidence.supportingFeatures`에 additive로 붙인다.
- `lib/spring-ts/src/report/cards/life-stage-fortune-card.ts`
  - 현재 대운의 십신/12운성/운 신살 annotation을 evidence/highlights로 소비.
- `lib/spring-ts/src/spring-engine.ts`
  - `targetDate` 기준으로 세운/월운 창을 확장하는 `sajuOptions`를 자동 주입.
  - 기본값:
    - `saeunStartYear = targetYear - 1`
    - `saeunYearCount = 4`
    - `wolunStartYear = targetYear - 1`
    - `wolunMonthCount = 24`
  - 명시적으로 들어온 caller option은 보존.
- `lib/spring-ts/src/saju-adapter.ts`
  - `wolunStartYear`가 있으면 saju-ts fortune `maxMonths`를 target month가 포함되도록 확장.
- `lib/saju-ts/src/compat/springLegacy.ts`
  - `LegacySajuOptions.wolunStartYear` 추가.
  - 확장된 세운/월운 요청이 있으면 `facts['fortune.timeline']`의 full timeline을 사용.
  - raw full timeline shape의 `stem: number`, `branch: number`도 처리하도록 `entryStemIdx`, `entryBranchIdx`를 추가.

테스트 중 실제로 발견해 고친 버그:

- spring-ts 런타임 테스트는 saju-ts `dist`를 읽기 때문에, saju-ts source 수정 후 `npm run build`를 하지 않으면 오래된 변환 결과를 보게 된다.
- full timeline row shape가 summary view와 달라서, 처음에는 확장 세운/월운이 모두 `GAP/JA`처럼 보이는 문제가 있었다.
- `entryStemIdx`/`entryBranchIdx` 추가 후 1986-04-19 남성, target `2026-05-04T00:00:00+09:00` 샘플에서 다음처럼 정상화됨:
  - 2026 세운: `BYEONG/O`, 십신 `JEONG_JAE`, 12운성 `절`, 12신살 `JANGSEONG`
  - 2026-05 월운: `IM/JIN`, 십신 `GYEOB_JAE`, 12운성 `양`, 12신살 `WOL_SAL`, 상문 true

## 4. 마지막 검증 결과

마지막 커밋 직전 기준 전부 통과했다.

| 위치 | 명령 | 결과 |
|---|---|---|
| `lib/saju-ts` | `npm run typecheck` | PASS |
| `lib/saju-ts` | `npm run build` | PASS |
| `lib/saju-ts` | `npx vitest run src/compat/transitShinsal.test.ts` | 1/0 PASS |
| `lib/spring-ts` | `npm run typecheck` | PASS |
| `lib/spring-ts` | `npm run build` | PASS |
| `lib/spring-ts` | `npm run test:transit-luck-report` | 10/0 PASS |
| `lib/spring-ts` | `npm run test:adapter-daewoon` | 21/0 PASS |
| `lib/spring-ts` | `npx tsx tools/baseline_snapshot.ts verify` | 15/0 PASS |
| `lib/spring-ts` | `npm run test:namespring-compat` | 208/0 PASS |
| `lib/spring-ts` | `npm run test:tiered-shape` | 1378/0 PASS |
| `lib/spring-ts` | `npm run test:service-visible-output` | 13/0 PASS |
| repo root | `git diff --check` | PASS |

주의:

- 이전 지시서에는 namespring compat 기대치가 202로 적혀 있었지만, 현재 브랜치의 실제 통과 수는 208이다.
- Windows sandbox에서 `tsx`/`vitest` 계열은 `spawn EPERM`이 날 수 있다. 이 경우 같은 명령을 권한 승인 후 다시 실행해야 한다.

## 5. 새 세션에서 먼저 확인할 것

```bash
git status --short --branch
git --no-pager log --oneline -8
cd lib/saju-ts && npm run build
cd ../spring-ts && npm run test:transit-luck-report
cd ../spring-ts && npx tsx tools/baseline_snapshot.ts verify
```

예상:

- 브랜치가 `feature/saju-engine-integrity-audit`.
- HEAD가 `b2b9cc3f8` 또는 이 문서 커밋 이후.
- untracked `.claude/`, `lib/spring-ts/tmp/`는 그대로 있을 수 있다.
- baseline snapshot은 15/15여야 한다.

## 6. 다음 작업 후보

### 6.1 바로 할 수 있는 운영 작업

1. 브랜치를 push하고 PR을 연다.
2. PR 설명에는 과제 1/2/3, PR-8 surface, PR-8 report consumption을 커밋 단위로 분리해 적는다.
3. PR 체크에서 실패하면 먼저 saju-ts build 산출물 stale 여부와 Windows sandbox 권한 문제를 의심한다.

### 6.2 PR-8 후속 기능 후보

이번 PR-8은 "운 메타데이터 표면화 + 백엔드 evidence 소비"까지다. 다음은 아직 끝났다고 보면 안 된다.

- 대운과 세운 사이의 상호관계 판정
- 운과 원국의 합충형해파 관계를 canonical relation evidence로 더 체계화
- 일운 노출
  - 현재 월운은 노출했지만 일운은 기본 `maxDays=0`라 product surface에 없다.
- tiered/category의 `thisYear` 메타까지 PR-8 annotation을 일관 소비
  - 단, 이 작업은 shape/service-visible-output 테스트와 미성년 안전 문구 검사를 반드시 같이 봐야 한다.
- 삼재/상문/조객을 본문 문장으로 더 강하게 쓰는 작업
  - 공포 조장, 단정, 미성년 금칙어를 피해야 한다.
- 운성/십신 메타를 전문 모드 표나 상세 카드로 확장
  - 프론트 수정이 필요해질 수 있으므로 사용자 지시 없이는 시작하지 말 것.

### 6.3 하지 말아야 할 것

- 프론트엔드 수정 금지. 사용자가 명시적으로 열어주기 전까지 `namespring/` 쪽은 건드리지 않는다.
- `shinsalHits` 원국 스트림에 transit 신살을 섞지 않는다.
- 명식 원국 신강약/격국/별점 점수를 PR-8 명목으로 바꾸지 않는다.
- `git add -A` 금지. 반드시 경로를 명시해 stage한다.
- `.claude/`, `lib/spring-ts/tmp/`는 보존한다.

## 7. PR-8 검증 자료

원래 감사 미검증 항목을 확인한 JSON들이 다음 임시 경로에 있다.

```text
lib/spring-ts/tmp/pr8-verify/
```

이 경로는 untracked 임시 자료다. 다음 세션에서 설계 근거를 다시 확인할 때 읽으면 된다. 단, 커밋에 포함하지 않는 것을 기본으로 한다.

## 8. 재개 프롬프트

다음 세션에 그대로 붙여넣을 수 있는 짧은 프롬프트:

```text
저장소 namespring-web, 브랜치 feature/saju-engine-integrity-audit에서 이어서 작업하라.
다른 브랜치로 checkout하지 말 것.

먼저 lib/spring-ts/docs/HANDOFF_SAJU_ENGINE_PR8_20260709.md 를 정독하고,
git status --short --branch, git --no-pager log --oneline -8 로 현재 HEAD와 워킹트리를 확인하라.

현재 완료된 것:
- 과제 1 종격 권위 코퍼스 20건
- 과제 2 만세력 오라클 453건
- 과제 3 인사이트 해석 콘텐츠
- PR-8 운 메타데이터 엔진 표면화
- PR-8 운 메타데이터 백엔드 리포트 evidence/highlights 소비

프론트엔드는 건드리지 말 것.
엔진 판정 점수, 원국 shinsalHits, baseline surface를 바꾸는 작업은 별도 PR로 분리할 것.
git add -A 금지. .claude/ 와 lib/spring-ts/tmp/ 는 건드리지 말 것.

먼저 cd lib/saju-ts && npm run build 를 실행한 뒤,
cd ../spring-ts && npm run test:transit-luck-report &&
npx tsx tools/baseline_snapshot.ts verify &&
npm run test:namespring-compat 를 재검증하라.
```
