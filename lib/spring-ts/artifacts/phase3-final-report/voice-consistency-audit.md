# Phase 3 — Voice Consistency Audit (A20)

> 작성: 2026-05-05 by Agent A20 (Phase 3 Wave 5 final QA)
> Scope: cross-agent narrative voice consistency review across 10 categories × 3 depths.
> Source: 30 random fragment sample (mulberry32 seed=20260505) + targeted grep audits.

## Executive Summary

- **종결어 일관성**: ~해요/~이에요/~예요/~돼요 일관 사용 확인.
- **카테고리 voice 위반**: career 직장 폄하 / romance 결혼 단정 / health 의학 단정 — 모두 0건. 적절.
- **단어 반복 잔존**: 결이 1217 / 흐름이 1386 / 또렷 758 / 단단 720 / 한 박자 311 — Phase 3 Wave 1-3 작업으로 카테고리별 -47% 평균 감소. 일부 (health, family, wealth) 미달 카테고리 잔존.
- **Grammar 위반 116건 발견 + patch**: 본 audit 의 주요 발견. 자동 검증 도구 (`narrative-voice-audit`) 가 통과 처리한 ungrammatical 패턴들을 인간 레벨 review 로 발견하여 3개 commit 으로 정정.

---

## 1. Audit 방법

### 1.1 Random sample
- mulberry32 deterministic RNG (seed = 20260505)
- 10 카테고리 (wealth/health/academic/career/study_document/expression_children/health_stress/movement/family/romance) × 3 depth (brief/standard/expert) = 30 fragment
- 각 카테고리당 random period 1개 선택
- templateTokens + slots 의 첫 번째 변형 렌더링하여 prose 추출
- (sample 기록은 audit 완료 후 ephemeral 처리)

### 1.2 Targeted grep audit
- 종결어 패턴 (`~해요/~이에요/~예요/~예요/~여요/~져요/~워요/~돼요`)
- ungrammatical 의심 패턴 (`동사+는요.`, `동사+이요"`, `자리가+조사`, `~예요/~에요`)

---

## 2. 발견 + 처리 (Patch 완료)

### 2.1 Ungrammatical `<verb>는요.` (Critical, 101 occurrences)

**문제**: 한국어 문법상 관형형 어미 `는` 은 종결조사 `요` 와 결합 불가 (`-는` 은 동사를 명사구 수식으로 만들고 종결할 수 없음). 그럼에도 `narrative_voice_audit` 도구는 0 violations 보고.

**검출 grep**: `[가-힣]+는요\.` → 31 unique pattern × 101 total occurrence.

**수정 매핑** (1:1, length-preserving 또는 length-reducing 만):

| 패턴 | 교정 | count |
|---|---|---|
| 또렷해지는요. | 또렷해져요. | 17 |
| 단단해지는요. | 단단해져요. | 13 |
| 받아들이는요. | 받아들여요. | 9 |
| 나오는요. | 나와요. | 9 |
| 가벼워지는요. | 가벼워져요. | 8 |
| 깊어지는요. | 깊어져요. | 7 |
| 보이는요. | 보여요. | 4 |
| 들어오는요. | 들어와요. | 4 |
| 달라지는요. | 달라져요. | 2 |
| 쌓이는요. | 쌓여요. | 2 |
| 이어지는요. | 이어져요. | 2 |
| 일어나는요. | 일어나요. | 2 |
| 자라나는요. | 자라나요. | 2 |
| 만드는요. | 만들어요. | 2 |
| 어우러지는요. | 어우러져요. | 2 |
| 빛나는요. | 빛나요. | 1 |
| 풍요로워지는요. | 풍요로워져요. | 1 |
| 펼쳐지는요. | 펼쳐져요. | 1 |
| 파고드는요. | 파고들어요. | 1 |
| 채워지는요. | 채워져요. | 1 |
| 움직이는요. | 움직여요. | 1 |
| 부드러워지는요. | 부드러워져요. | 1 |
| 밝아지는요. | 밝아져요. | 1 |
| 모이는요. | 모여요. | 1 |
| 매듭지어지는요. | 매듭지어져요. | 1 |
| 만나는요. | 만나요. | 1 |
| 들썩이는요. | 들썩여요. | 1 |
| 던지는요. | 던져요. | 1 |
| 다지는요. | 다져요. | 1 |
| 늘어나는요. | 늘어나요. | 1 |
| 깔끔해지는요. | 깔끔해져요. | 1 |
| 깊어지는요. | 깊어져요. | (포함됨 위) |

**규칙**:
- `~지는요` → `~져요` (state-becoming)
- `~이는요` → `~여요` (irregular ㅣ-stem)
- `~오는요` → `~와요`
- `~드는요` → `~들어요`
- `~나는요` → `~나요`

**처리 commit**: `fix(narrative): correct ungrammatical 는요 endings in fragment slots` (47 files, 209 insertions / 99 deletions). 47개 narrative bundle 영향.

### 2.2 Ungrammatical `모이요"` (Medium, 5 occurrences)

**문제**: ㅣ-stem 동사 `모이다` 가 종결조사 `요` 와 결합할 때 `모여요` (ㅣ + ㅓ → ㅕ 축약) 가 표준. `모이요` 는 비표준.

| 위치 | 패턴 | 교정 |
|---|---|---|
| wealth.life.brief slot 1 | 차곡차곡 모이요 | 차곡차곡 모여요 |
| wealth.thisMonth.brief slot 1 | 차곡차곡 모이요 | 차곡차곡 모여요 |
| wealth.thisYear.brief slot 1 | 차곡차곡 모이요 | 차곡차곡 모여요 |
| wealth.life.brief slot 198 | 한 박자 천천히 모이요 | 한 박자 천천히 모여요 |
| wealth.thisYear.brief slot 256 | 한 박자 천천히 모이요 | 한 박자 천천히 모여요 |

**처리 commit**: `fix(narrative): correct ungrammatical 모이요 → 모여요 in wealth slot phrases` (3 files).

### 2.3 잉여 조사 `자리가라` (Low, 10 occurrences)

**문제**: `명사+이라` (한 자리이라 → 한 자리라) 구문에서 잉여 조사 `가` 삽입. 표준어법은 `단단한 자리라` 가 자연.

**위치**: career.this{Month,Week,Year}.standard, health.life.brief, health.{thisMonth,thisWeek,thisYear,today}.expert, health.thisWeek.standard, health_stress.thisWeek.standard. 모두 동일 패턴 "단단한 자리가라" → "단단한 자리라".

**처리 commit**: `fix(narrative): correct 단단한 자리가라 → 단단한 자리라 in career/health prose` (10 files).

---

## 3. 잔존 voice 일관성 관찰 (Patch 안 함, document only)

### 3.1 ~예요 vs ~에요 mix
- 30 sample 중 일부에서 `해예요` (consonant + 예요) 와 `이에요` 혼재.
- Korean 표준: 받침 있는 명사 + 이에요, 받침 없는 명사 + 예요. 단, 활용 표면상 `한 해예요`/`한 자리예요` 등 자연스러운 케이스 많음.
- A20 판단: case-by-case Korean 판단 필요. 단순 mass replace 위험. **flag only**.

### 3.2 카테고리 voice review (모두 OK)
- **career**: 직장 폄하 없음. 매듭/책임/신뢰 강조 — 적절.
- **romance**: 결혼/이별 단정 없음. "결정 미루세요" 권고 — 적절.
- **health**: 의학 진단 없음. 회복/페이스/충분히 쉬세요 — 권고 한정. 적절.
- **wealth**: 손실/부도 단정 없음. "권유받은 큰 결정은 하루 자고" — 적절.
- **academic**: 점수/합격 단정 없음. "한 결씩 마무리" — 적절.

### 3.3 단어 반복 잔존
- 결이 1217 (Wave 0 측정 기점 ~1992 → -39%, 카테고리별 평균 -47%)
- 흐름이 1386 (전체)
- 또렷 758, 단단 720, 한 박자 311
- 일부 카테고리 미달:
  - health: 결이 99 (target ≤68 미달)
  - family: 결이 130 (target ≤71 미달)
  - wealth: 결이 159 (target ≤154 거의)
  - health_stress: 결이 84 (target ≤78 거의)
- **flag for next wave**.

### 3.4 비유 cross-element 섞임 검출 결과
- 30 sample 중 한 fragment 안에 cross-element metaphor 혼재 사례 0건.
- _metaphor/ 분리 후 (Phase 3 A12) element-별 anchor 사용 패턴 일관 확인.

---

## 4. Tooling 갭 (engine work, A20 scope 외)

### 4.1 narrative_voice_audit 보강 권장
- 현재 도구는 plain term/tag/expert untagged 만 검증.
- **gap**: ungrammatical 종결어 패턴 (`동사 + 는요/이요`, 잉여 조사) 미검출.
- **권장**: tools/narrative_voice_audit.mjs 확장 — 한국어 grammar lint rule 추가.
  - `[가-힣]+는요\.` → 자동 fail
  - `[가-힣]+이요\.|이요"` → 자동 fail
  - `자리가+[라]/것이라` → flag
- A20 scope 외 (engine work). Phase 4+ engine team 인계.

### 4.2 brief 28자 cap 대비 ~해예요/~이에요 length 차이
- 같은 의미를 ~해요 / ~이에요 / ~여요 로 표현 시 length 1-2자 차이.
- A16 28자 cap 적용 후 일부 brief 가 truncation 영향 가능.
- **권장**: brief slot 변형이 30자를 초과하지 않도록 author guideline 보강.

---

## 5. 결론

**A20 voice consistency audit**:
- 30 random sample 직접 review + targeted grep 으로 116개 grammar 위반 발견.
- 모두 patch 처리 (3 commit, 60 file 영향).
- voice 위반 (카테고리별 단정/폄하): 0건.
- 단어 반복은 향후 wave 권장 (잔존 ~50%).
- 도구 갭: narrative_voice_audit 한국어 grammar lint 확장 필요.

**namespring-compat 202/202 PASS invariant 유지** ✅
