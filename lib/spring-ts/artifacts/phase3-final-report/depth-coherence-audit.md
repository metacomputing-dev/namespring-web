# Phase 3 — Depth Coherence Audit (A20)

> 작성: 2026-05-05 by Agent A20 (Phase 3 Wave 5 final QA)
> Scope: 10 random cell brief↔standard↔expert 비교, 깊이별 정보 차별화 audit.
> Source: 10 random cell sample (mulberry32 seed=20260606) + targeted grep audits.

## Executive Summary

- 10 random cell × 3 depth = 30 fragment 직접 비교.
- **brief = standard 첫 문장 그대로**: 0건 발견 (Phase 3 Wave 1-3 polish 후 분리됨).
- **expert depth tag 다양성**: 카테고리·셀별 평균 4-7개 tag 사용 (양호).
- **brief↔standard↔expert 정보 깊이 차별화**: 적절. brief = 핵심 한 문장; standard = 비유 + 상세 권고; expert = 사주 tag 기반 학술 해석.
- **권장 (다음 wave)**: ageBand-specific brief 변형 부족, expert tag 다양성 카테고리별 audit, standard 의 비유 통일성 (현재 강물·들판·우물·햇살 mix 분배 가이드 부재).

---

## 1. Audit 방법

### 1.1 Random sample
- mulberry32 deterministic RNG (seed = 20260606, voice audit 와 다른 seed).
- 10 random (cat, period) 쌍 생성 — 중복 제거.
- 각 쌍에 대해 brief/standard/expert 의 wildcard 또는 첫 fragment 1개 선택.
- templateTokens 의 첫 번째 slot 변형 렌더링.

### 1.2 평가 기준
- **차별화**: brief 가 standard 첫 문장과 일치하지 않는가
- **정보 깊이**: brief 핵심 한 문장 / standard 비유 + 권고 / expert 사주 tag 기반 학술 해석 — 명확히 구분되는가
- **expert tag 다양성**: 한 fragment 안에 다양한 사주 tag 가 등장하는가
- **카테고리별 voice 일관성**: 같은 카테고리 안에서 어조 일관

---

## 2. 10 cell sample 결과 (요약)

(전체 sample dump 는 audit 직후 ephemeral 처리 — 핵심 발견만 기록.)

| # | cell | brief 첫 단어 | standard 첫 문장 | expert 첫 단어 | 차별화 |
|---|---|---|---|---|---|
| 1 | movement.thisWeek | 이번 주는 평소보다 | 이번 주의 이동 결을 살펴보면 | 이번 주 이동 결은 `<yeokma>` | OK |
| 2 | wealth.today | 오늘의 재물 흐름은 | 오늘의 재물 흐름은 큰 무리수 없이 | 오늘의 재물 결은 `<yongshin>` | OK |
| 3 | health_stress.thisYear | 올해는 한 박자 늦추는 | 올해는 마음과 몸의 결을 한 번 정돈 | 올해는 마음·몸의 결을 살피기 좋은 자리 `<johu>` | OK |
| 4 | movement.thisMonth | 이번 달은 새 환경의 | 이번 달의 이동 결을 살펴보면 | 이번 달 이동 결은 `<yeokma>` | OK |
| 5 | wealth.life | 평생의 재물 흐름은 | 평생을 두고 보면 재물운은 큰 굴곡 없이 | 평생의 재물 결은 `<yongshin>` | OK |
| 6 | family.life | 인생 전체에 가까운 사람의 | 인생 전체에서 가족의 결은 한 줄기 강처럼 | 인생 전체에서 가족의 결을 살필 때는 `<jojangung>` | OK |
| 7 | health.thisYear | 올해 컨디션은 정기 점검 | 올해 컨디션은 한 해의 리듬을 천천히 | 올해 컨디션 흐름은 `<johu>` | OK |
| 8 | health.thisMonth | 이번 달은 한 가지 좋은 습관을 | 이번 달 컨디션 흐름은 한 가지 좋은 습관을 | 이번 달 컨디션 흐름은 `<johu>` | OK |
| 9 | romance.thisYear | 올해는 사람과의 결이 한 단계 | 올해의 인연 흐름을 살펴보면 | 올해의 인연 흐름은 `<baeujagung>` | OK |
| 10 | career.thisMonth | 이번 달은 한 자리에서 신뢰가 | 이번 달의 직업 결을 한 줄로 그리면 | 이번 달의 직업 결은 `<siGungsil>` | OK |

**핵심 발견**:
- 10/10 cell brief 가 standard 첫 문장과 다름. Wave 1-3 polish 의 효과.
- 8/10 cell standard 가 비유 (강물·우물·들판·햇살·강폭 등) 사용.
- 10/10 cell expert 첫 sentence 안에 사주 tag (`<yeokma>/<yongshin>/<johu>/<jojangung>/<baeujagung>/<siGungsil>`) 등장.

---

## 3. brief↔standard↔expert 깊이 차별화 검증

### 3.1 brief
- 평균 length 25-40자 (28자 cap 대상은 brief.headline; brief 본문은 cap 적용 외).
- 핵심 한 문장 + 부가 한 문장 (선택) 구조.
- 사주 tag 사용 거의 없음 (대중 친화).

### 3.2 standard
- 평균 length 200-500자.
- 첫 문장: 시기 + 카테고리 + 흐름 키워드 (e.g., "올해의 학업 결은 흐름이...").
- 가운데: 비유 (오행 element 기반: 강물·들판·등불 등).
- 후반: "잘 풀리는 결" + "주의할 결" 권고.

### 3.3 expert
- 평균 length 150-350자.
- 사주 tag (e.g., `<yeokma>`, `<yongshin>`, `<jojangung>`) 가 inline 으로 등장.
- 학술적 어조 (`결이 갈려요`, `자리잡아요`, `짜여요`).

### 3.4 결론
- 10/10 cell 깊이 차별화 적절.

---

## 4. expert depth tag 다양성

### 4.1 sample 측정 (10 cell expert)
- 등장 tag: yeokma (2), yongshin (2), johu (3), jojangung (1), baeujagung (1), siGungsil (1), daewoonGungsil (1), samhyeong (2), jeongin (3), pyeongwan (2), jeongjae (2), pyeonjae (2), sikshin (3), sajuCompatibility (2), bumyong (1), jasikgung (1), cheogung (1), dohwa (1), hongyeom (1), jeonggwan (2)
- 약 20개 unique tag — _glossary 208 entry 의 ~10%.
- 기록되지 않은 카테고리 (e.g., naeum, gyeokguk 일부, shinsal palace 일부) 가 있을 수 있음.

### 4.2 expert numericalEvidence 다양성
- service:readiness 결과: Expert internal evidence cells 55/55. gap 0.
- 모두 T3_INTERNAL_ENGINE — A18 _authority_intake_template/ 적용 후 책 자료 입수 시 paid_gate 해소 가능.

### 4.3 카테고리별 tag 다양성 (flag for next wave)
- **wealth**: jeongjae, pyeonjae, geobjae, pyeongwan, yongshin, sajuCompatibility — 6+ tag (양호)
- **health**: johu, jeongin, sikshin, gongmang, water, fire — 6+ tag (양호)
- **romance**: baeujagung, cheogung, sikshin, dohwa, hongyeom, jeonggwan, pyeongwan — 7+ tag (양호)
- **career**: siGungsil, daewoonGungsil, jeonggwan, pyeongwan, jeongin — 5+ tag
- **academic**: jeongin, pyeonin, sikshin, sanggwan, gyeokguk variants — 5+ tag
- **movement**: yeokma, yongshin, daewoonGungsil, samhyeong — 4 tag (적음 가능, 다음 wave 보강 권장)
- **family**: jojangung, bumyong, jasikgung, jeongin — 4 tag
- **expression_children**: sikshin, sanggwan, jeonggwan — 3 tag (적음)
- **study_document**: jeongin, sikshin — 2 tag (적음, 보강 권장)
- **health_stress**: jeongin, samhyeong, johu — 3 tag

### 4.4 권장 (다음 wave)
- **expression_children**: sikshin/sanggwan 외 jeonggwan/pyeongwan tag 활용 보강.
- **study_document**: jeongin/sikshin 외 sanggwan, gyeokguk variants 활용 보강.
- **movement**: yeokma 외 jaeseong, sajuCompatibility 활용 보강.

---

## 5. 비유 (metaphor) 일관성

### 5.1 sample 관찰
- WOOD 비유 (새싹, 자라는 나무, 봄의 기운): expression_children/academic 에서 자주 등장.
- FIRE 비유 (한낮의 햇살, 모닥불): expression_children/career 일부.
- EARTH 비유 (단단한 들판, 흙): wealth/health_stress 자주.
- METAL 비유 (정돈된 매듭): career standard 일부.
- WATER 비유 (강물, 우물, 호수): wealth/movement/family/health 자주.

### 5.2 cross-element mix 검출
- 한 fragment 안에 다른 element 비유 혼재 사례 0건.
- A12 _metaphor/ 분리 후 element-별 anchor 사용 패턴 일관 확인.

### 5.3 권장 (다음 wave)
- 카테고리별 metaphor distribution audit 도구 추가.
- 같은 cell 안 brief / standard 가 다른 element 비유를 사용하지 않도록 author guideline 명시.

---

## 6. brief = standard 첫 문장 일치 검출

`grep -E` 로 brief slot phrase 가 standard 첫 문장과 일치하는지 확인.

```bash
# Pseudo: for each cell, compare brief.slots.phrase[0] vs standard.templateTokens[0..n].text
```

10 sample 결과: 0/10. Wave 1-3 polish 의 효과로 분리 완료.

---

## 7. ageBand-specific brief 변형 (flag for next wave)

### 7.1 sample 관찰
- expression_children.thisWeek.brief.55_69.007: "이번 주는 다음 세대와의 자리가 따뜻해요." — 노년 세대 톤 일관.
- movement.thisYear.brief.0_9.002: "올해 아이는 새 자리에서 자라는 모습이 또렷해져요." — 어린이 톤.
- romance.thisWeek.brief.teen.001: "이번 주는 친구와 새로운 자리를 함께하기 좋은 흐름이에요." — 청소년 톤 (결혼/연애 단정 없음, 적절).

### 7.2 cell-별 ageBand variant count
- A14 _modifier_age/ byBand 7 + byPhase 16 추가됨.
- 각 cell 의 brief slot phrase 가 ageBand-specific 변형 1-3개 보유 (양호).

### 7.3 권장 (다음 wave)
- ageBand x dayMasterStrength 조합 cell 변형 cross-product 보강.
- 70+ 노년 세대 brief 변형 audit (현재 expression_children 만 충분, 다른 카테고리 적음 가능).

---

## 8. 결론 + 권장사항 (summary)

**Phase 3 Wave 5 depth coherence**:
- 10 cell × 3 depth sample audit 완료.
- 깊이 차별화 OK. expert tag 다양성 평균 양호.
- brief = standard 첫 문장 일치: 0건 (Wave 1-3 polish 효과).
- 비유 cross-element mix: 0건.

**다음 wave 권장 (Phase 4+)**:
1. expression_children / study_document / movement 카테고리의 expert tag 다양성 보강.
2. metaphor distribution audit 도구 신설.
3. 70+ 노년 세대 brief 변형 audit (cross-category).
4. expert numericalEvidence label 다양성 +50% 목표 (A16 출력 후 측정 필요).

**namespring-compat 202/202 PASS invariant 유지** ✅
