# PLAN: Tiered Matrix 아티클 엔진 전면 재작성

> 2026-07-03 시작. 브랜치 `claude/tiered-article-rewrite`.
> 배경 진단: 유료 리포트 1회 생성 29~35초(그중 76%가 정규식 사후 땜질), 프론트 번들 9.0MB,
> "상세 근거" 텍스트가 문장 조각 조립 + 4겹 정규식 수리로 생성되어 상업 품질 미달(동료 리뷰 판정).
> 결정: 문장 조각(fragment) 조립 아키텍처를 폐기하고, **완결된 글(article) 단위 콘텐츠 모델**로 교체한다.

## 0. 불변 제약 (반드시 지킬 것)

1. **프론트엔드(namespring/) 수정 금지.** `FortuneTieredMatrix` 출력 스키마를 100% 유지한다.
   프론트가 실제로 읽는 필드(정찰로 확정):
   - `tieredMatrix.periods[kind]` → `periodKind`, `periodLabel`, `periodMeta`, `overall`, `byCategory`, `byAgeBand`
   - `byAgeBand[band]` → `periodLabel`, `selectorAgeBand`, `overall`, `byCategory`, `startAge`, `endAge`
   - 셀(`TieredFortune`) → `meaningfulness`, `stars`, `brief.headline`, `brief.hook`,
     `standard.paragraphs[].plainText|tokens`, `standard.livingTips`, `standard.cautions`,
     `expert.paragraphs[].tokens`(태그 토큰), `expert.numericalEvidence`, `selectedFragments.expert.tags`
   - `glossary.entries[tagId].hashLabel|label`, `glossary.usedInThisReport`
2. **결정성 유지.** 동일 (생년월일시+성별+기준일) → 동일 텍스트. 셀렉션은 시드 해시로만.
3. **NO_AI_POLICY 준수.** 런타임 LLM 의존 금지. 오프라인 저작 콘텐츠는 `aiGenerated: true` 마킹 유지.
4. **런타임 텍스트 재작성 금지.** 렌더러는 슬롯 주입과 태그 토큰화만 한다. 정규식 치환 파이프라인 재도입 금지.
   품질 문제는 소스 아티클을 고쳐서 해결한다 (WYSIWYG 원칙).

## 1. 새 아키텍처

### 1.1 콘텐츠 모델 — `data/articles/`

- 원자 단위 = **아티클**: 한 사람이 한 호흡으로 쓴 완결된 글.
  `요약(brief) + 본문 3~4문단(standard) + 전문가 근거 1~2문단(expert) + 생활 팁/주의`가 한 편에 동거.
- 파일 배치: `data/articles/<category>/<period>.articles.json` (기간 셀용)
  + `data/articles/<category>/stages.articles.json` (life 연령대 밴드 셀용)
- 스키마: `spring-ts.article.v1` — 상세는 `docs/ARTICLE_STYLE_CONTRACT.md` §2.

### 1.2 선택 축 (조합 폭발 제거)

| 축 | 값 | 비고 |
|---|---|---|
| category | overall + 10개 | 기존과 동일 |
| period | life/today/thisWeek/thisMonth/thisYear | 기존과 동일 |
| audience | `adult` / `teen`(10-19) / `child`(0-9) / `stage-teen·early·mid·senior·elder` | 주인공(사주 당사자) 연령 기반. stage-*는 byAgeBand 셀 전용 |
| band | `high`(별4-5) / `mid`(별3) / `low`(별1-2) / `any` | 셀 등급(gradeCell)에서 도출. 어조 일치용 |

- 기존 11차원 게이팅(성별×계절×강약×용신×격국…)은 **선택 축에서 제거**한다.
  개인화는 (a) expert 문단의 슬롯(일간/용신/계절 명칭 주입), (b) 엔진이 계산하는 수치 근거로 달성.
- 선택 알고리즘: `(category, period, audience)` 풀에서 `band 정확 일치 → 'any'` 순 폴백,
  variant는 `fnv1a(seedKey|cat|period|audience|band) % n`.
- 매칭 아티클이 없으면 기존과 동일하게 `meaningfulness:'na'` 플레이스홀더 셀 (게이트가 커버리지 완전성을 보증하므로 정상 경로에선 발생 불가).

### 1.3 밴드 ↔ 연령대(byAgeBand) 매핑

- `10-19`→stage-teen, `20-29·30-39`→stage-early, `40-49·50-59`→stage-mid,
  `60-69·70-79`→stage-senior, `80-89·90-99·100-109`→stage-elder.
- stage 아티클은 주어 중립("이 시기는…")으로 저작해 현재 미성년 주인공의 미래 밴드에도 그대로 쓴다.
- 밴드 라벨("30~39세")은 `{{periodLabel}}` 슬롯으로 주입.

### 1.4 렌더러 (`article-renderer.ts`)

- 슬롯: `{{periodLabel}}`, `{{dayMasterName}}`, `{{yongshinName}}`, `{{currentSeasonName}}` 4종만.
  조사 결합: `{{yongshinName:이가}}` → 받침 유무로 이/가 선택. 지원 조사쌍: 이가/은는/을를/과와/으로로/이라라.
- 태그: `#{tagId}` → 글로서리 lookup → `{kind:'tag', tagId, label}` 토큰. **expert 전용** (standard는 태그 금지).
- 산출: `TaggedParagraph { tokens, plainText }` — 기존 타입 그대로.
- 이것 외의 텍스트 변형 없음.

### 1.5 수치 근거 (numerical-evidence 대체)

- 구 방식(내부 enum 순번 "연령 단계 순번: 6단계") 폐기.
- 엔진이 명식에서 계산한 **의미 있는** 수치만: 사주 내 용신 오행 개수, 일간 오행 개수,
  기간 중심 오행–용신 관계 등급(1~5), 현재 나이. `sourceTier: T3_INTERNAL_ENGINE` 유지.

### 1.6 유지되는 것

- `gradeCell`/`gradeCategoryCell`(별점·의미도), `period-meta-builder`, 대운 기반 밴드 오행,
  `glossary-loader`/`tag-inliner`, `namingEvidence`, `buildSelectionSeed`, 매트릭스 조립 골격.
- `selectedFragments` 필드는 아티클 트레이스로 채움: `fragmentId=articleId`, `gating={audience,band}`, `tags=expert 태그`.

### 1.7 삭제되는 것 (Phase 3a)

- `fragment-registry.ts`, `fragment-selector.ts`, `standard-depth-enhancer.ts`(8,653줄),
  `minor-audience-sanitizer.ts`, `numerical-evidence.ts`(대체), `template-engine.ts`의 normalize 계열 전부,
  `build-tiered-matrix.ts` 내 polish/minor-fallback 보정 로직.
- `data/narrative/**` 중 `_glossary/`(유지) 제외 fragment 번들 전부 (약 8.6MB).
- 관련 구 아키텍처 강제 테스트/도구 (§4 트리아지 표 참조).

## 2. 코퍼스 계획 (총 330편)

카테고리(11)당 30편:

| audience | 수량 | band |
|---|---|---|
| adult | 5기간 × 3밴드 = 15 | high/mid/low |
| teen (10-19 주인공) | 5기간 × 1 = 5 | any |
| child (0-9 주인공, 보호자 독자) | 5기간 × 1 = 5 | any |
| stage-* (byAgeBand) | 5단계 × 1 = 5 | any |

- 저작 순서: `wealth`를 모범 코퍼스로 직접 저작·검증 → 나머지 10개 카테고리를 서브에이전트 팬아웃.
- 품질 기준·문체·금지어는 `docs/ARTICLE_STYLE_CONTRACT.md`가 단일 진실. 게이트 불합격분은 재작성.
- 예상 총량: ~330편 × 650자 ≈ 21만 자 ≈ JSON ~700KB (기존 8.9MB 대비 -92%).

## 3. 품질 게이트 (`tools/article-quality-gate.ts` + 테스트)

빌드 타임 검증 (위반 = 실패):
1. 스키마/enum/ID 유일성, 커버리지 완전성(모든 필수 (cat×period×audience×band) 존재).
2. 분량: 본문 3~4문단, 문단당 2~5문장·80~240자, 전체 350~800자. expert 1~2문단(100~380자, 태그 2~6개).
   summary ≤60자 1문장, hook ≤24자, livingTips 2~3개(≤30자), cautions 1~2개(≤44자).
3. 상투어 캡: '흐름'≤3, '기운'≤3, '자리'≤2, '호흡'≤1, 명사 '결' 0회.
4. 금지 문구(구 파이프라인 잔재+패딩 메타문구) 0회.
5. 어미: 해요체 통일(습니다/합니다 금지), 명령형 금지.
6. 슬롯·태그 유효성: 허용 슬롯 4종+유효 조사쌍만, `#{tagId}`는 글로서리 존재, standard에 태그 금지.
7. 중복: 동일 문장이 카테고리 내 2편 이상에 등장 금지 (복붙 저작 차단).

## 4. 테스트 트리아지 방침 (Phase 3b)

- **유지(계약 수준)**: matrix shape, determinism, progressive-disclosure, name-frame-evidence,
  isolation-guard(콘텐츠가 스코어링을 임포트하지 않음) — 새 엔진에 맞게 어서션 갱신.
- **대체**: 구 fragment/enhancer/normalize를 직접 임포트·검증하는 테스트
  (tiered-fragment-selector, tiered-selector-contract, tiered-gyeol-compound-boundary,
  tiered-standard-readable-depth, brief-headline-invariant, paid-copy 회귀 등)
  → 아티클 게이트 테스트 + 렌더러 단위 테스트 + 새 골든 샘플로 대체.
- **은퇴**: 밀도/커버리지/래칫 지표 측정 도구(tools/measure_*), coverage 리포트 계열.

## 5. 진행 체크리스트

- [x] 정찰: 출력 스키마·프론트 소비 필드·의존 관계 확정
- [x] Phase 0: 브랜치 + WIP 체크포인트 커밋 + 구 루프 은퇴 선언(PLAN_PHASES_RETIRED.md)
- [x] Phase 1: 아티클 스키마·레지스트리·렌더러·게이트 구현, build-tiered-matrix 통합
- [x] Phase 2a: wealth 모범 코퍼스 직접 저작 + 엔드투엔드 검증(typecheck/벤치/샘플/게이트)
- [x] Phase 2b: 나머지 10개 카테고리 에이전트 팬아웃 저작 + 게이트 통과 (330편, 게이트 위반 0)
- [x] Phase 3a: 구 파이프라인·구 데이터 제거, 임포트 정리
- [x] Phase 3b: 테스트 트리아지, 스위트 그린 (2026-07-04)
      - shape 테스트 아티클 코퍼스에 맞게 갱신(fragmentCount≥330, stage-scoped trace id)
      - progressive-disclosure: fragment 시대 awkward-join 블록리스트(400여 구절) 은퇴,
        런타임 계약(brief 평문/standard 무태그/expert 태그/문장 간격)만 유지
      - service-visible: '검진'(의료 인접) 소스 6개 파일 수정 + 게이트 `vocab-medical-adjacent` 추가
      - build-tiered-matrix: brief/standard selectedFragments.tags = [] (per-tier 트레이스 정합)
      - NO_AI_POLICY: 66개 번들에 비권위 sourceTier 추가 → `ci:no-ai-policy` 통과
      - package.json: test:integration 체인에서 죽은 참조 제거, article/feature-vector 테스트 추가;
        삭제 도구 참조 스크립트 28개 정리; acceptance-manifest 동기화
      - 참고: `test:hanja-pool`은 브랜치와 무관한 선반영 실패(브랜치가 naming 코드 미변경, main에서도 동일)
- [ ] 최종: 벤치마크 before/after, 유료 UI 샘플 재생성, 결과 보고

## 6. 리스크와 대응

- **글 품질 편차(에이전트 저작)** → 스타일 계약 + 모범 예시 2편 + 게이트 + 표본 정독, 불합격 재작성.
- **스키마 회귀** → 기존 shape/determinism 테스트를 새 엔진에서 그대로 통과시키는 것을 완료 조건으로.
- **성능 회귀 재발** → 벤치 스크립트를 `tools/`에 상주시키고 목표치(매트릭스 빌드 < 300ms) 문서화.
- **외부 야간 루프와의 충돌** → 본 브랜치에서만 작업, 계획·은퇴 문서로 의도 명시.
