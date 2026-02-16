# spring-ts

name-ts (이름 분석)와 saju-ts (사주 분석)를 **연결하는 중재자(mediator)** 라이브러리입니다.

사주 정보를 이름 점수에 반영하여, 생년월일에 맞는 최적의 이름을 추천합니다.

---

## 한눈에 보는 구조

```
UI (namespring)
     │
     │  SpringRequest { birth, surname, givenName?, mode }
     ▼
┌─────────────────────────────────────────────────────────────┐
│                      SpringEngine                            │
│                      (spring-engine.ts)                       │
│                                                              │
│  1. init()  ── DB 초기화 + 사격 행운수 테이블 미리 계산       │
│                                                              │
│  2-A. getNamingReport()  ── 이름만 분석 (사주 무관)          │
│  2-B. getSajuReport()    ── 사주만 분석                      │
│  2-C. getNameCandidates()── 이름 추천 (사주+이름 통합)       │
│  2-D. analyze()          ── 레거시 통합 API (하위호환)       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                분석 파이프라인                        │     │
│  │                                                     │     │
│  │  ① saju-adapter     사주 분석 실행 + 결과 정규화    │     │
│  │       │                                             │     │
│  │       ▼                                             │     │
│  │  ② name-ts 계산기    발음오행 + 획수오행 + 사격수리  │     │
│  │       │                                             │     │
│  │       ▼                                             │     │
│  │  ③ SajuCalculator   사주↔이름 오행 궁합 점수 계산   │     │
│  │       │                                             │     │
│  │       ▼                                             │     │
│  │  ④ spring-evaluator  이름점수 + 사주점수 가중합산    │     │
│  │       │                                             │     │
│  │       ▼                                             │     │
│  │  ⑤ 정렬 + 페이지네이션 → SpringResponse 반환        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  3. close() ── DB 자원 해제                                  │
└──────────────────────────────────────────────────────────────┘
```

### spring-ts가 하는 일 (한 줄 요약)

> **"이 사람의 사주에 부족한 오행을 이름으로 보충해주는 최적의 조합을 찾는다"**

---

## 분석 파이프라인 상세

### ① 사주 분석 (saju-adapter.ts)

```
생년월일시 + 성별
      │
      ▼
  saju-ts 엔진 호출 (동적 import)
      │
      ▼
  raw 사주 데이터 (Map, Set 등 복잡한 구조)
      │
      ▼
  extractSaju() 로 정규화
      │
      ▼
  SajuSummary {
    pillars:      년주/월주/일주/시주 (천간+지지)
    dayMaster:    일간 (오행+음양)
    strength:     일간의 강약 (신강/신약)
    yongshin:     용신 (보충이 필요한 오행)
    gyeokguk:     격국 (사주의 구조적 패턴)
    elementDistribution:  오행 분포 {WOOD: 3, FIRE: 1, ...}
    tenGodAnalysis:       십성 분석 (비겁/식상/재성/관성/인성)
    ...
  }
```

### ② name-ts 계산기 (name-ts에서 가져옴)

이름 자체의 성명학 점수를 계산합니다 (사주와 무관한 순수 이름 분석).

- **HangulCalculator**: 발음 오행 + 음양
- **HanjaCalculator**: 획수 오행 + 음양
- **FrameCalculator**: 사격 수리 길흉

### ③ 사주 궁합 계산 (saju-calculator.ts)

```
이름의 오행 배열  +  사주의 용신/희신/기신
         │
         ▼
   ┌─────────────────────────────────────┐
   │  SajuCalculator.computeScore()      │
   │                                     │
   │  네 가지 요소를 가중합산:            │
   │                                     │
   │  1. 오행 균형 (balance)      ~40%   │  ← 이름이 사주의 부족한 오행을 채워주는가?
   │  2. 용신 친화도 (yongshin)   ~30%   │  ← 이름 오행이 용신/희신과 맞는가?
   │  3. 일간 강약 (strength)     ~12%   │  ← 신강이면 설기, 신약이면 보강하는가?
   │  4. 십성 배치 (tenGod)        ~5%   │  ← 십성 그룹 분포가 균형 잡혔는가?
   │                                     │
   │  + 격국/부족원소 보정                │
   │                                     │
   │  → 0~100점 사주 궁합 점수            │
   └─────────────────────────────────────┘
```

### ④ 최종 합산 (spring-evaluator.ts)

```
  이름 점수 (name-ts)          사주 점수 (saju-calculator)
       │                              │
       ▼                              ▼
  ┌──────────────────────────────────────────────┐
  │         springEvaluateName()                  │
  │                                               │
  │  적응형(Adaptive) 모드:                        │
  │    사주 신뢰도가 높으면 → 사주 비중 ↑          │
  │    사주 신뢰도가 낮으면 → 이름 비중 ↑          │
  │                                               │
  │  이름 점수 × (이름 비중) + 사주 점수 × (사주 비중)  │
  │                                               │
  │  → 종합 점수 (0~100)                          │
  └──────────────────────────────────────────────┘
```

---

## 파일별 역할

### `src/` -- 소스 코드

```
src/
├── spring-engine.ts      # 메인 엔진: init() → getNamingReport() / getSajuReport() / getNameCandidates() / analyze() → close()
│                         #   DB 로딩, 후보 생성, 점수 계산, 정렬, 페이지네이션
│                         #   3-메서드 API (이름만/사주만/통합) + 레거시 analyze() 하위호환
│
├── spring-evaluator.ts   # 최종 점수 합산기
│                         #   name-ts 점수와 saju 점수를 가중합산
│                         #   적응형(adaptive) / 엄격(strict) 모드 지원
│
├── saju-adapter.ts       # saju-ts 중재자
│                         #   사주 엔진 호출 → raw 결과를 SajuSummary로 정규화
│                         #   analyzeSajuSafe(): sajuEnabled 플래그 포함 안전한 분석
│                         #   사주 모듈 로드 실패 시 warning 로그 + fallback
│
├── saju-calculator.ts    # 사주↔이름 궁합 점수 계산기
│                         #   용신 친화도, 오행 균형, 일간 강약, 십성 배치
│                         #   4가지 요소를 적응형 가중치로 합산
│
├── types.ts              # TypeScript 타입 정의
│                         #   SpringRequest/Response, NamingReport, SajuReport, SpringReport,
│                         #   SajuSummary, PillarSummary, TenGodSummary 등 모든 인터페이스
│
└── index.ts              # 외부에 공개하는 export 목록
                          #   spring-ts 자체 + name-ts 전체를 re-export
```

### `config/` -- 설정 파일 (JSON)

```
config/
├── engine.json            # 엔진 설정: 후보 수 제한, 획수 범위, 페이지네이션, 버전
├── evaluator-policy.json  # 평가 정책: 사주 우선도, 가중치 배율, 적응형/엄격 모드 파라미터
├── saju-scoring.json      # 사주 점수 규칙: 용신 타입별 가중치, 오행 균형 페널티, 통과 기준
└── cheongan-jiji.json     # 천간/지지 참조 테이블: 10천간+12지지의 한글/한자/오행/음양
```

### `test/` -- 테스트

```
test/
├── compare-output.ts      # 통합 테스트: 평가/추천/복성/긴이름/사주구조 + getNamingReport/getSajuReport/getNameCandidates 검증
└── baseline.json          # 기준 출력값: 테스트의 기대 결과 (점수, 후보 목록, 사주 데이터)
```

---

## 핵심 개념 정리

### 용신 (Yongshin, 用神)

사주에서 **가장 필요한 오행**. 사주의 균형을 맞추기 위해 보충해야 하는 원소입니다.

```
예: 사주에 火와 土가 넘치고 Water가 부족하면
    → 용신 = Water
    → 이름에 水 계열 한자를 넣으면 궁합 점수 ↑
```

관련 개념:
- **희신** (Heesin): 용신을 돕는 보조 오행 → 차선책
- **기신** (Gisin): 사주에 해로운 오행 → 피해야 함
- **구신** (Gusin): 가장 해로운 오행 → 강하게 피해야 함

### 적응형 가중치

사주 분석의 **신뢰도**(confidence)에 따라 이름 점수와 사주 점수의 비중이 자동 조절됩니다.

```
신뢰도 높음 (예: 0.9) → 사주 비중 ↑ (약 48%)  이름 비중 ↓ (약 35%)
신뢰도 낮음 (예: 0.3) → 사주 비중 ↓ (약 23%)  이름 비중 ↑ (약 60%)
```

이는 사주 판단이 불확실할 때 이름 자체의 성명학 점수에 더 의존하도록 하는 안전장치입니다.

---

## 초기 설정

saju-ts 서브모듈이 필요한 경우 (사주 분석 활성화):

```bash
git submodule update --init --recursive
cd lib/saju-ts && npm install && npm run build
```

saju-ts 없이도 동작합니다. 콘솔에 warning이 표시되고, `sajuEnabled: false`로 이름 분석만 수행됩니다.

---

## 사용 예시

```typescript
import { SpringEngine } from 'spring-ts';

const engine = new SpringEngine();
await engine.init();

// ── 1. 이름만 분석 (사주 무관) ──
const namingReport = await engine.getNamingReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
});
namingReport.totalScore;                    // 55.9
namingReport.scores;                        // { hangul: 70, hanja: 57.5, fourFrame: 60 }
namingReport.analysis.fourFrame.frames;     // NamingReportFrame[] with meaning data

// ── 2. 사주만 분석 ──
const sajuReport = await engine.getSajuReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
});
sajuReport.sajuEnabled;                     // true (saju-ts 로드 성공 여부)
sajuReport.dayMaster;                       // { stem, element, polarity }
sajuReport.yongshin;                        // { element, heeshin, confidence, ... }

// ── 3. 이름 추천 (사주+이름 통합) ──
const candidates = await engine.getNameCandidates({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenNameLength: 2,
  mode: 'recommend',
});
candidates[0].finalScore;                   // 통합 점수
candidates[0].namingReport;                 // NamingReport (이름 분석)
candidates[0].sajuReport;                   // SajuReport (사주 분석)
candidates[0].sajuCompatibility;            // SajuCompatibility (궁합)
candidates[0].rank;                         // 1

// ── 4. 레거시 API (하위호환) ──
const evalResult = await engine.analyze({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  mode: 'evaluate',
});
evalResult.candidates[0].scores;            // { total, hangul, hanja, fourFrame, saju }

engine.close();
```

---

## name-ts와의 관계

```
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│   namespring   │      │   spring-ts    │      │    saju-ts     │
│   (UI/React)   │ ───▶ │   (중재자)      │ ───▶ │   (사주 엔진)   │
│                │      │                │      │                │
│                │      │   ┌──────────┐ │      └────────────────┘
│                │      │   │ name-ts  │ │
│                │      │   │(이름분석)│ │
│                │      │   └──────────┘ │
└────────────────┘      └────────────────┘
```

- **name-ts**: 이름 자체의 성명학 분석 (사주와 무관)
- **spring-ts**: name-ts + saju-ts를 통합하여 최종 점수 산출
- **saju-ts**: 생년월일 기반 사주팔자 분석 (외부 서브모듈)

spring-ts의 `index.ts`는 name-ts의 모든 public API를 **re-export**하므로, UI에서는 `spring-ts` 하나만 import하면 됩니다.

---

## 의존성

- **name-ts** -- 이름 분석 엔진 (같은 monorepo 내 `../name-ts`)
- **saju-ts** -- 사주 분석 엔진 (같은 monorepo 내 `../saju-ts`, 동적 import)
- **sql.js** -- SQLite WASM (name-ts를 통해 간접 사용)
