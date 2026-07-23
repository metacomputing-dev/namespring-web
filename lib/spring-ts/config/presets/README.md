# School Presets

이 디렉터리의 JSON은 학파 이름과 설명만 관리한다. 점수 계산에 쓰는 모든 값은 다음 단일 정책 파일에 있다.

```text
../naming-evidence-weights.json
```

`yongshinTypeWeights`와 `adaptiveWeights`의 기본값 및 학파별 차이는 `presetOverrides`에서 수정한다. `src/preset-loader.ts`의 `loadPreset()`은 메타데이터와 공유 정책의 가중치를 합쳐 읽기 전용 프리셋을 만든다.

프리셋은 `SpringOptions.precisionConfig.useSchoolPreset === true`일 때만 점수에 반영된다. 프리셋을 사용하지 않거나 `korean`을 선택하면 같은 기본값을 사용한다.

## 프리셋

| ID | 방향 |
| --- | --- |
| `korean` | 한국식 기본값 |
| `chinese` | 전통 구조 판단 강조 |
| `modern` | 현대 통합·조후 강조 |
| `korean_modern` | 현대 한국 작명 관점 |
| `classical_text` | 고전 문헌 규칙 강조 |
| `naming_safe` | 과도한 보강보다 균형과 충돌 회피 강조 |

## 수정 절차

1. 이름이나 설명은 이 디렉터리의 해당 JSON에서 수정한다.
2. 계산 가중치는 `config/naming-evidence-weights.json`에서 수정한다.
3. 새 프리셋은 `presetOverrides`, `SchoolPresetName`, `PRESETS`, 공개 옵션 타입에 함께 추가한다.
4. `npm run test:naming-evidence-generation`과 `npm run test:presets`를 실행한다.

기본값 변경은 모든 이름 점수와 생성 문안의 강조 순서에 영향을 주므로 의도와 예상 차이를 함께 기록한다.
