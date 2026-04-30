# config/presets — School-specific scoring weights

`SajuCalculator` reads its school-dependent weights (`yongshinTypeWeights`,
`adaptiveWeights`) from these JSONs **only when**
`SpringOptions.precisionConfig.useSchoolPreset === true`. The legacy path
(no `precisionConfig`) keeps reading from `../saju-scoring.json` and
behaves exactly as before.

## Files

| File | School | 핵심 차이 |
| --- | --- | --- |
| `korean.json` | 이석영 사주첩경 / 한국 현대 작명 표준 (default) | `saju-scoring.json` 의 값과 정확히 동일 (zero-op preset) |
| `chinese.json` | 자평진전 / 적천수 — 격국 우선 | GYEOKGUK 0.85 → 1.0, JOHU 0.95 → 0.85, yongshinBase 0.23 → 0.28 |
| `modern.json` | 한국 현대 통합 — 조후 강조 | JOHU 0.95 → 1.0, EOKBU 1.0 → 0.95, GYEOKGUK 0.85 → 0.8 |

## Schema

```jsonc
{
  "schoolName": "Human-readable label",
  "description": "Sentence explaining what diverges from korean.json",
  "yongshinTypeWeights": {
    "EOKBU": 1.0,         // 억부 (balance) — 일간 강약 보강
    "JOHU": 0.95,          // 조후 (climate) — 한열조습 균형
    "TONGGWAN": 0.9,       // 통관 (mediator) — 충돌 해소
    "GYEOKGUK": 0.85,      // 격국 (structure) — 월령 중심
    "BYEONGYAK": 0.8,      // 병약 (pathology) — 병/약 진단
    "JEONWANG": 0.75,      // 전왕 (dominance) — 종격 보강
    "HAPWHA_YONGSHIN": 0.7,// 합화 (transformation) — 5합 기반
    "ILHAENG_YONGSHIN": 0.7// 일행 (single-element) — 일기격
  },
  "adaptiveWeights": {
    "balanceBase": 0.6,   // ↓ 격국 우선 학파에서 낮춤
    "balanceMin":  0.35,
    "balanceMax":  0.6,
    "yongshinBase": 0.23, // ↑ 격국 우선 학파에서 높임
    "yongshinMin":  0.23,
    "yongshinMax":  0.48,
    "strengthFixed": 0.12,
    "tenGodFixed":   0.05,
    "shiftDivisor":  70,
    "confidenceWeight": 0.4,
    "baseShiftRatio":   0.22,
    "confidenceBoost":  0.08,
    "baseConfidenceRatio": 0.6
  }
}
```

`adaptiveWeights` 사용 시 `saju-scoring.json#/adaptiveWeights` 위에 spread merge
되므로 preset 은 **다른 값만** 선언해도 됨 (현재는 가독성을 위해 모두 mirror).

## 사용법

```typescript
const candidates = await engine.getNameCandidates({
  birth: { ... },
  surname: [...],
  givenNameLength: 2,
  options: {
    schoolPreset: 'chinese',                // 어느 school 사용할지
    precisionConfig: { useSchoolPreset: true }, // 명시적 opt-in
  },
});
```

`precisionConfig.useSchoolPreset` 가 `true` 가 아니면 `schoolPreset` 값은
spring-ts 의 자체 scoring 에 영향을 주지 않습니다 (saju-ts pass-through 만 됨).

## 학파 차이의 출처

자세한 학파별 비교 + 권위 인용: `spring-info/06_external_refs/03_korean_schools.md §2`.

## 추가 / 수정

새 preset 추가 시:
1. 이 폴더에 `<school>.json` 추가 (스키마 위 §Schema 참조)
2. `src/preset-loader.ts` 의 `SchoolPresetName` union + `PRESETS` 맵 갱신
3. `src/types.ts` 의 `SpringOptions.schoolPreset` 의 union 갱신
4. 회귀 검증: `npm run test:presets`

기존 preset 의 값 수정 시:
1. PR description 에 "intent" + "expected diff" 명시
2. `npm run validate:regression` 으로 default-mode 0 차이 보장 (preset 미선택 시 영향 없음)
3. `tests/integration/school-presets.test.ts` 의 expected 값 업데이트 (의도된 차이)
