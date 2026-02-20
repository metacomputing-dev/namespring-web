# saju-math-engine

수학/데이터-구동 관점으로 **사주(四柱) 계산을 “작은 코어 + 확장 가능한 규칙”** 형태로 재구성한 TypeScript 엔진입니다.

이 레포는 **기존 프로젝트의 출력/테스트 호환**을 목표로 하지 않습니다.
대신, 아래 원칙을 중심으로 **처음부터 새로** 설계한 “엔진 뼈대 + API 계약 + 백로그”를 제공합니다.

- **API 계약은 고정**: 내부 구현이 바뀌어도 요청/응답 스키마와 결과 번들 포맷은 유지
- **계산은 DAG(의존 그래프)로 표현**: 결과와 근거(입력, 중간값, 공식)까지 자동 추적
- **룰/가중치/유파는 config(JSON)로**: 코드 변경 없이 교체 가능
- **순환 구조(10/12/60)는 모듈러 산술로**: 관계/조합 하드코딩 최소화

## Requirements

- Node.js **>= 20** (ESM 전용)

## Quickstart (개발)

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run audit
npm run golden:verify
```

## Usage (예시)

```ts
import { createEngine, defaultConfig } from 'saju-math-engine';

const engine = createEngine(defaultConfig);

const bundle = engine.analyze({
  birth: {
    instant: '1984-02-02T12:00:00+09:00'
  },
  sex: 'M',
  location: { lat: 37.5665, lon: 126.9780, name: 'Seoul' }
});

console.log(bundle.summary);
console.log(bundle.report.trace.nodes.slice(0, 3));
```

## Output

엔진은 항상 `AnalysisBundle`을 반환합니다.

- `summary`: 요약 결과(구조화 JSON)
- `report`: 전체 결과 + **근거/계산값/공식(trace)**(구조화 JSON)
- `artifacts`: 부가 데이터(옵션) — JSON 또는 zip(pack)

자세한 계약은 `docs/01_api_contract.md`를 보세요.

## Monorepo notes

- `/cal` 폴더는 별도의 TypeScript 포팅(calculator 비교/검증용) 패키지입니다.
- `cal`의 `npm run verify`는 **오프라인/결정적 검증**만 포함합니다.
  (외부 사이트 live 검증은 `BAZISIFU_LIVE=1 npm run verify:bazisifu` 처럼 opt-in)

## Docs

- `docs/00_overview.md` — 설계 목표/철학
- `docs/01_api_contract.md` — 요청/응답 계약
- `docs/03_math_primitives.md` — 천간/지지/오행/관계 수학
- `docs/04_calculation_graph.md` — DAG 평가/추적
- `docs/10_shinsal_catalog.md` — 신살 카탈로그(데이터팩) 구조
- `docs/BACKLOG.md` — 구현 백로그 (체크리스트)
- `docs/PROGRESS.md` — 진행 기록

---

> ⚠️ 주의: 사주는 전통 체계(유파/절기 계산/자시 처리 등)에 따라 정의가 다릅니다.
> 본 엔진은 **정책(policy)을 config로 분리**해, “정의 차이”를 코드가 아니라 데이터로 다룰 수 있게 설계합니다.
