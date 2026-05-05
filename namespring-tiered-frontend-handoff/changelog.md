# Tiered Frontend Handoff Changelog

이 문서는 `namespring-tiered-frontend-handoff/` 의 운영 변경 이력과, 이 폴더가 다루는 `lib/spring-ts/` 의 narrative / glossary / contract / engine 변경을 한 줄에 요약한다. FE 개발자는 큰 변경이 있을 때 이 파일만 보고 영향 범위를 빠르게 파악할 수 있다.

기록 단위: 한 묶음 (Phase / Wave) 마다 한 절. 항목별 변경 이유와 backward-compat 여부를 같이 적는다.

---

## 2026-05-05 — Phase 3 Refinement (Opus 4.7, 21 agents / 4 wave)

**한 줄 요약**: tiered 출력의 어휘 다양성과 brief 캡 invariant를 강화하고, glossary / metaphor / modifier 데이터 풀을 보강했다. API 시그니처는 변하지 않는다.

### Glossary (`data/narrative/_glossary/`)

- entries 130 → 208 (+78). 카테고리별 증가:
  - `pillar` 14 → 40 (+26). 60갑자 납음, 십이운성 12단계 보강.
  - `naeum` 7 → 32 (+25). 60갑자 납음 풀 사이클 정리.
  - `shinsal` 20 → 28 (+8). 12신살 추가 entry.
  - `tenGod` 20 → 25 (+5). 정관·정인·식신 등 보조 정의.
  - `element` 15 → 20 (+5). 오행별 보조 정의.
  - `gyeokguk` 18 → 21 (+3). 가화격 / 가종격 / 일행득기격 보강.
  - `yongshin`, `compatibility`, `palace` 각 +2.
- 모든 entry는 `aiGenerated: true`, `sourceTier.tier: T1_HYPOTHESIS`. 권위 truth 자격 없음.
- 자세한 구분은 [`glossary-review.md`](./glossary-review.md).

### Metaphor library (`data/narrative/_metaphor/`) — NEW

- Phase 2 의 `library.json` (영문 tone enum) 옆에 element 별 5개 bundle 추가:
  - `wood.json`, `fire.json`, `earth.json`, `metal.json`, `water.json`. 각 18 anchor, 총 90 anchor.
- anchor 별 `id`, `label`, `tone` (한글 9 enum), `context` (시기 / 시간대 / depth / age band conditional), `exampleUsage`.
- 작성 가이드: `data/narrative/_metaphor/usage_guide.md`.
- 두 라이브러리는 한 fragment 안에서 섞이지 않게 사용 (element bundle 우선).

### Modifier 풀 (`_modifier_gender/`, `_modifier_age/`)

- `_modifier_gender/phrases.json`: byGender 11 카테고리 × 3 (male / female / neutral) 약 600 phrase.
- `_modifier_age/phrases.json`: byBand 7 단계 + byPhase 16 단계 (early / late teen / 20s / … / 80s / 90+) phrase pool 추가.
- 어떤 fragment 가 modifier 슬롯을 비워두고 들어와도 selector 가 채울 수 있게 풀 두께를 보강.

### Narrative fragment (카테고리 11 × 기간 5 × 깊이 3)

- 11 카테고리 단어 반복 평균 -47%. 큰 감소 영역:
  - romance -59%, career -67%, study_document -63%, academic -60%, expression_children -55%, movement -63%.
- "결이" 빈도 168 → 87. "흐름이" 빈도는 legacy card path에서 분산.
- overall 카테고리: brief headline 28자 위반 752 → 0 (template-engine post-normalize 압축).
- expert tier tag diversity: overall 25 → 41+, romance 18 신규 anchor.
- 자세한 cell × depth 분포는 [`coverage-matrix.md`](./coverage-matrix.md).

### Engine (`src/`)

- `src/report/cards/`: legacy NameSpring 카드 (period / subdomain / life-fortune / life-stage) 의 "흐름이" 어휘 분산.
- `src/report/tiered/template-engine`: brief headline 후처리에서 28자 cap 보장 (`normalizeRenderedText` 후 압축 step 추가).
- `src/saju-calculator`: `safetyProfile.reasons` 콜론 라벨로 dedup. `yongshinMode: 'consensus_aware'` posture 보강 (per-axis 근거 surface).
- `src/report/tiered/feature-selector`: FeatureVector 가 35 numeric axis 까지 확장 (이전 13 + 22 신규 — 이 PR 산출 확장은 fragment 측이 향후 사용 가능).

### Authority intake

- `test/baseline/authority/_authority_intake_template/` 신설. 책 자료 ingestion template + README + EXAMPLE.
- 검증: `T3_AUTHORED_INTERPRETATION` (modern 책) / `T4_PRIMARY_TEXT` (classical 발췌) 만 authority truth 자격.
- T2 / T1 / T0 는 자격 없음. `npm run ci:no-ai-policy` 가 차단.

### Backward compat

- API 시그니처 무변경. `getFortuneReport` / `getSpringReport` / `getNameCandidateSummaries` 호출자 영향 0.
- `npm run test:namespring-compat` 202/202 PASS 유지.
- 새 default flip 0건. 모든 새 surface (`surfaceTieredMatrix`, `surfacePalace`, `surfaceNaeum`, `yongshinMode: 'consensus_aware'` 등) 는 opt-in.
- `getFortuneReport` 의 top-level 키 13개 (legacy) → 14개 (tiered). `tieredMatrix` 만 추가, 다른 키는 모두 보존.

### 샘플

- `lib/spring-ts/artifacts/sample-outputs-2026-05-05-phase3/`: 15 fixture 의 출력 캡처 + `diff-legacy-vs-tiered.json` 자동 생성.
- 7 fixture (carry-over) + 8 fixture (Phase 3 신규: 강한 격국, 외격 후보, 야자시 / 절기 boundary, strengthMode=continuous, palace/naeum opt-in, consensus_aware yongshin).

---

## 2026-05-02 — Phase 2 baseline (참고용)

- glossary 50 → 130 entries (Phase 2 Wave 1).
- `_metaphor/library.json` (Phase 2 metaphor) 도입.
- tieredMatrix v1 schema 동결.
- NameSpring legacy 호환성 검증 (`test:namespring-compat`).

---

## 운영 원칙

- 변경 단위: 한 묶음 (Wave / Phase) 끝에 한 절 추가. 한 commit 안에서 changelog 단독 추가는 가능, 코드 변경과 함께 묶을 때는 같은 commit 에 포함.
- 큰 변경 (default flip, schema bump, 신규 top-level 키) 발생 시 가장 위에 `WARNING:` 한 줄 추가.
- `coverage-matrix.md`, `copy-style-guide.md`, `glossary-review.md` 의 본문 수치는 wave 종료 시 일괄 갱신. 본 changelog 만 매 commit 단위로 한 줄씩 누적해도 무방.
