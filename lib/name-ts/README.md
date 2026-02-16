# name-ts

한국 이름의 **성명학적 분석**을 수행하는 순수 계산 엔진입니다.

사주(四柱)와 무관하게, 이름 자체의 음양오행 조화·획수·사격 등을 평가합니다.

> **역할 독립성**: name-ts는 사주(saju-ts)나 통합 엔진(spring-ts)의 존재를 모릅니다.
> 순수하게 이름 분석만 담당하므로, 단독으로 사용하거나 다른 시스템에 임베드할 수 있습니다.
> 사주와 이름을 결합한 분석이 필요하면 [spring-ts](../spring-ts/)를 사용하세요.

---

## 한눈에 보는 구조

```
사용자 입력 (성 + 이름 한자/한글)
        │
        ▼
   ┌─────────┐
   │ NameTs   │  ← 진입점 (name.ts)
   │ .analyze()│
   └────┬─────┘
        │  성/이름 HanjaEntry[] 전달
        ▼
   ┌──────────────────────────────────────────────┐
   │               evaluateName()                  │  ← 평가 오케스트라 (evaluator.ts)
   │                                               │
   │  3개의 Calculator를 순서대로 실행:             │
   │                                               │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  │ HangulCalc   │  │ HanjaCalc    │  │ FrameCalc    │
   │  │ (발음 오행)   │  │ (획수 오행)   │  │ (사격 수리)   │
   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
   │         │                 │                 │
   │         ▼                 ▼                 ▼
   │      signal            signal            signal
   │   (점수+통과여부)     (점수+통과여부)     (점수+통과여부)
   │                                               │
   │  ──────────── 가중평균 합산 ────────────────── │
   │                                               │
   └───────────────────┬───────────────────────────┘
                       ▼
               종합 점수 + 해석 텍스트
```

### 3가지 분석 축

| 분석 | 기준 | 예시 |
|------|------|------|
| **발음 오행** (HangulCalc) | 초성 자음 → 오행, 모음 → 음양 | "김" → 초성 ㄱ = 목(Wood), 모음 ㅣ = 양 |
| **획수 오행** (HanjaCalc) | 한자 획수 끝자리 → 오행, 홀짝 → 음양 | "金" = 8획 → 금(Metal), 짝수 → 음 |
| **사격 수리** (FrameCalc) | 성+이름 획수 조합 → 원형이정 4격 | 원격·형격·이격·정격 각각의 길흉 판정 |

각 축에서 **오행 배치 조화** (상생이 많은가? 상극이 없는가?)와 **음양 균형** (양과 음이 골고루인가?)을 점수화합니다.

---

## 파일별 역할

### `src/` -- 소스 코드

```
src/
├── name.ts                  # 진입점: NameTs 클래스 (.analyze() 메서드)
├── index.ts                 # 외부에 공개하는 export 목록
│
├── model/                   # 도메인 모델 (데이터 표현)
│   ├── element.ts           #   오행 클래스 (Wood, Fire, Earth, Metal, Water)
│   ├── polarity.ts          #   음양 클래스 (Positive=양, Negative=음)
│   ├── energy.ts            #   음양 + 오행을 합친 "에너지" 객체
│   └── types.ts             #   분석 결과 인터페이스 (HangulAnalysis, HanjaAnalysis, FourFrameAnalysis)
│
├── calculator/              # 분석 계산기 (핵심 로직)
│   ├── evaluator.ts         #   평가 오케스트라: Calculator들을 모아서 가중평균 합산
│   ├── hangul.ts            #   발음 오행 계산기: 초성→오행, 모음→음양 분석
│   ├── hanja.ts             #   획수 오행 계산기: 한자 획수 기반 오행/음양 분석
│   ├── frame.ts             #   사격 수리 계산기: 원형이정 4격 길흉 분석
│   ├── scoring.ts           #   공통 수학 함수: 오행 상생/상극 판정, 배열 점수, 균형 점수
│   └── search.ts            #   이름 후보 탐색: 사격 수리가 좋은 획수 조합을 미리 계산
│
├── database/                # DB 접근 (SQLite)
│   ├── hanja-repository.ts  #   한자 사전 DB: 한자→획수/뜻/오행 조회
│   ├── fourframe-repository.ts  # 사격수 의미 DB: 1~81번 수리 길흉 조회
│   └── name-stat-repository.ts  # 이름 통계 DB: 인기도/빈도 조회
│
└── utils/
    └── index.ts             # 한글 분해, 자모 필터, 해석문 생성 등 유틸
```

### `config/` -- 설정 파일 (JSON)

코드에서 매직 넘버를 제거하고, 도메인 전문가가 코드 수정 없이 튜닝할 수 있도록 분리한 설정 파일들입니다.

```
config/
├── scoring-rules.json       # 점수 계산 규칙 (상생 보너스, 상극 페널티, 음양 티어 등)
├── korean-phonetics.json    # 한국어 음운 데이터 (양성모음 목록, 초성→오행 매핑, 유니코드 상수)
├── five-elements.json       # 오행 순환 테이블 (획수 끝자리→오행 매핑)
├── interpretation.json      # 해석문 템플릿 (점수 구간별 해석 문구)
└── database.json            # DB 설정 (테이블명, 페이지 크기 등)
```

---

## 핵심 개념 정리

### 오행 (Five Elements)

```
     목(Wood)
    ↗        ↘
수(Water)    화(Fire)      ← 상생 (Generating): 시계방향 화살표
    ↖        ↙                 목→화→토→금→수→목
     금(Metal) ← 토(Earth)

     목(Wood)
    ╱    ╲
수(Water) → 화(Fire)      ← 상극 (Overcoming): 별 모양
    ╲    ╱                     목→토, 토→수, 수→화, 화→금, 금→목
     금(Metal) ─ 토(Earth)
```

- **상생** (generating): 인접 오행이 서로 도와주는 관계 → 가산점
- **상극** (overcoming): 인접 오행이 서로 충돌하는 관계 → 감점

### 음양 (Yin-Yang / Polarity)

- **양** (Positive): 밝고 열린 모음 (ㅏ, ㅗ, ㅑ...) 또는 홀수 획수
- **음** (Negative): 어둡고 닫힌 모음 (ㅓ, ㅜ, ㅕ...) 또는 짝수 획수
- 좋은 이름은 음과 양이 **골고루 섞여** 있어야 합니다

### 사격 (Four Frames)

| 격 | 한자 | 계산 방법 | 의미 |
|----|------|-----------|------|
| 원격 | 元格 | 이름 글자 획수 합 | 초년운 |
| 형격 | 亨格 | 성 + 이름 첫 글자 획수 합 | 청년운 |
| 이격 | 利格 | 성 + 이름 끝 글자 획수 합 | 중년운 |
| 정격 | 貞格 | 성 + 이름 전체 획수 합 | 말년운 |

각 격의 획수합을 1~81 범위로 변환한 뒤, 수리 길흉표에서 운세(최상/상/양/흉/최흉)를 조회합니다.

---

## 사용 예시

```typescript
import { NameTs, HanjaRepository, SqliteRepository } from 'name-ts';

// 1. DB 초기화
const sqliteRepo = new SqliteRepository();
await sqliteRepo.init('path/to/hanja.db');
const hanjaRepo = new HanjaRepository(sqliteRepo);

// 2. 이름 분석
const nameTs = new NameTs();
const result = nameTs.analyze({
  lastName:  [hanjaRepo.getEntry('崔')],
  firstName: [hanjaRepo.getEntry('成'), hanjaRepo.getEntry('秀')],
  birthDateTime: { year: 1986, month: 4, day: 19, hour: 5, minute: 45 },
  gender: 'male',
});

console.log(result.candidates[0].totalScore);      // 55.9
console.log(result.candidates[0].interpretation);   // "이름의 발음 오행은..."
```

---

## 의존성

- **sql.js** -- 브라우저/Node.js에서 SQLite를 실행하기 위한 WASM 기반 라이브러리
- 외부 라이브러리 의존 없음 (순수 TypeScript)
